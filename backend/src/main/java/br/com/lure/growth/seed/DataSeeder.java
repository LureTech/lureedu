package br.com.lure.growth.seed;

import br.com.lure.growth.auth.PasswordRules;
import br.com.lure.growth.catalog.Course;
import br.com.lure.growth.catalog.CourseRepository;
import br.com.lure.growth.catalog.Lesson;
import br.com.lure.growth.catalog.LessonRepository;
import br.com.lure.growth.catalog.QuizQuestion;
import br.com.lure.growth.catalog.QuizQuestionRepository;
import br.com.lure.growth.catalog.Section;
import br.com.lure.growth.catalog.SectionRepository;
import br.com.lure.growth.common.TextUtils;
import br.com.lure.growth.config.AppProperties;
import br.com.lure.growth.user.Role;
import br.com.lure.growth.user.User;
import br.com.lure.growth.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Dados iniciais (idempotente):
 * <ul>
 *   <li>sem usuários → cria o admin de {@code app.admin.*};</li>
 *   <li>sem seções → cria as 9 seções padrão;</li>
 *   <li>{@code app.seed.demo=true} e sem módulos → membro demo + 2 módulos por seção.</li>
 * </ul>
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    static final String DEMO_EMAIL = "membro@lure.com.br";
    static final String DEMO_PASSWORD = "Membro@2026";

    private final UserRepository users;
    private final SectionRepository sections;
    private final CourseRepository courses;
    private final LessonRepository lessons;
    private final QuizQuestionRepository quizQuestions;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;
    private final TransactionTemplate tx;

    public DataSeeder(UserRepository users, SectionRepository sections, CourseRepository courses,
                      LessonRepository lessons, QuizQuestionRepository quizQuestions, PasswordEncoder passwordEncoder,
                      AppProperties props, PlatformTransactionManager transactionManager) {
        this.users = users;
        this.sections = sections;
        this.courses = courses;
        this.lessons = lessons;
        this.quizQuestions = quizQuestions;
        this.passwordEncoder = passwordEncoder;
        this.props = props;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(String... args) {
        tx.executeWithoutResult(status -> seedAdmin());
        tx.executeWithoutResult(status -> seedSections());
        if (props.seed().demo()) {
            tx.executeWithoutResult(status -> seedDemo());
        }
    }

    private void seedAdmin() {
        if (users.count() > 0) {
            return;
        }
        String email = PasswordRules.normalizeEmail(props.admin().email());
        users.save(new User(email, passwordEncoder.encode(props.admin().password()), "Administrador LURE", Role.ADMIN));
        log.warn("Conta admin inicial criada: {} — TROQUE A SENHA no primeiro acesso (Perfil → Senha).", email);
    }

    private void seedSections() {
        if (sections.count() > 0) {
            return;
        }
        int order = 1;
        for (DemoContent.SectionSeed s : DemoContent.SECTIONS) {
            sections.save(new Section(s.id(), s.title(), s.subtitle(), order++));
        }
        log.info("{} seções padrão criadas.", DemoContent.SECTIONS.size());
    }

    private void seedDemo() {
        if (courses.count() > 0) {
            return;
        }
        if (!users.existsByEmail(DEMO_EMAIL)) {
            users.save(new User(DEMO_EMAIL, passwordEncoder.encode(DEMO_PASSWORD), "Membro Demo", Role.MEMBER));
            log.info("Membro demo criado: {} / {}", DEMO_EMAIL, DEMO_PASSWORD);
        }
        UUID adminId = users.searchForAdmin("").stream().filter(User::isAdmin).map(User::getId).findFirst()
                .orElse(null);
        Map<String, Integer> sortBySection = new HashMap<>();
        int created = 0;
        for (DemoContent.CourseSeed seed : DemoContent.COURSES) {
            if (!sections.existsById(seed.sectionId())) {
                continue; // seção removida pelo admin
            }
            int sortOrder = sortBySection.merge(seed.sectionId(), 1, Integer::sum);
            String slug = TextUtils.uniqueSlug(seed.title(), 160, "modulo", courses::existsBySlug);
            Course course = new Course(slug, seed.sectionId(), seed.title(), sortOrder, adminId);
            course.setDescription(seed.description());
            course.setAuthor(DemoContent.AUTHOR);
            course.setLocked(seed.locked());
            courses.saveAndFlush(course);

            List<DemoContent.LessonSeed> lessonSeeds = seed.lessons();
            for (int i = 0; i < lessonSeeds.size(); i++) {
                Lesson lesson = new Lesson(course.getId(), i + 1, lessonSeeds.get(i).title());
                lesson.setDescription(lessonSeeds.get(i).description());
                lessons.save(lesson);
            }
            for (int i = 0; i < seed.quiz().size(); i++) {
                DemoContent.QuestionSeed q = seed.quiz().get(i);
                quizQuestions.save(new QuizQuestion(course.getId(), i + 1, q.text(), q.options(), q.correctIndex()));
            }
            created++;
        }
        log.info("Conteúdo demo criado: {} módulos.", created);
    }
}
