import postgres from 'postgres';

/**
 * Conexão com o PostgreSQL do Supabase (schema "lure").
 * Aceita as mesmas variáveis do backend Java: DB_URL no formato JDBC
 * (jdbc:postgresql://host:porta/banco?...), DB_USERNAME e DB_PASSWORD.
 * DATABASE_URL (postgres://usuario:senha@host:porta/banco) também serve.
 */
function connectionOptions(): { url: string; username?: string; password?: string; schema?: string } {
  const direct = process.env.DATABASE_URL;
  if (direct) {
    return { url: direct };
  }
  const jdbc = process.env.DB_URL;
  if (!jdbc) {
    throw new Error('Defina DB_URL, DB_USERNAME e DB_PASSWORD (ou DATABASE_URL).');
  }
  const url = new URL(jdbc.replace(/^jdbc:/, ''));
  const schema = url.searchParams.get('currentSchema') ?? undefined;
  // O pooler do Supabase em modo sessão (5432) aceita só 15 clientes; funções serverless abrem
  // várias instâncias, então usamos o modo transação (6543) do mesmo host.
  if (url.hostname.endsWith('pooler.supabase.com') && url.port === '5432' && process.env.DB_SESSION_MODE !== 'true') {
    url.port = '6543';
  }
  // Parâmetros só do driver JDBC não significam nada aqui.
  for (const key of [...url.searchParams.keys()]) {
    if (key !== 'sslmode') {
      url.searchParams.delete(key);
    }
  }
  return {
    url: url.toString(),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    schema,
  };
}

function createSql() {
  const { url, username, password, schema } = connectionOptions();
  const local = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    username,
    password,
    ssl: local ? false : 'require',
    // Funções serverless: poucas conexões por instância e nada de prepared statements
    // (o pooler do Supabase em modo transação não os suporta).
    max: Number(process.env.DB_POOL_SIZE ?? 3),
    prepare: false,
    // O pooler derruba conexões paradas sem avisar: fecha as ociosas antes e recicla as antigas.
    idle_timeout: 10,
    max_lifetime: 5 * 60,
    connect_timeout: 10,
    connection: { search_path: process.env.DB_SCHEMA ?? schema ?? 'lure' },
    types: {
      // COUNT(*) e colunas BIGINT como number (os valores cabem com folga).
      bigint: {
        to: 20,
        from: [20],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

let instance: ReturnType<typeof createSql> | undefined;

export function db() {
  instance ??= createSql();
  return instance;
}

export type Sql = ReturnType<typeof createSql>;
export type Tx = postgres.TransactionSql<{ bigint: number }>;
/** Conexão ou transação: as consultas funcionam igual nos dois. */
export type Db = Sql | Tx;

/** Transação com lock do usuário: serializa "ler → decidir → gravar" do mesmo aluno. */
export function withUserLock<T>(userId: string, work: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${userId}, 0))`;
    return work(tx as unknown as Tx);
  }) as Promise<T>;
}

export function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return db().begin((tx) => work(tx as unknown as Tx)) as Promise<T>;
}

/**
 * Falha de conexão com o banco (não de SQL). "safe" = a consulta com certeza não chegou ao banco
 * (não conectou / não conseguiu enviar), então dá para repetir até um POST sem risco de gravar duas vezes.
 */
export function connectionError(err: unknown): { safe: boolean } | null {
  const code = (err as { code?: string } | null)?.code;
  const message = (err as { message?: string } | null)?.message ?? '';
  if (code === 'CONNECT_TIMEOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { safe: true };
  }
  if (code === 'CONNECTION_CLOSED' || code === 'CONNECTION_ENDED' || code === 'CONNECTION_DESTROYED') {
    return { safe: message.startsWith('write ') };
  }
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'ETIMEDOUT') {
    return { safe: false };
  }
  return null;
}

export function newId(): string {
  return crypto.randomUUID();
}

/** "Agora" com precisão de milissegundos (igual ao backend Java). */
export function now(): Date {
  return new Date();
}
