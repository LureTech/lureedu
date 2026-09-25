package br.com.lure.growth.common;

import br.com.lure.growth.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.concurrent.CompletableFuture;

/**
 * Envio de e-mail. Só usa SMTP quando {@code spring.mail.host} está configurado;
 * caso contrário escreve o conteúdo no log (útil em dev).
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final AppProperties props;

    public MailService(ObjectProvider<JavaMailSender> mailSender, AppProperties props) {
        this.mailSender = mailSender;
        this.props = props;
    }

    public boolean isEnabled() {
        return mailSender.getIfAvailable() != null;
    }

    /** Envia de forma assíncrona (não atrasa a resposta nem revela se o e-mail existe). */
    public void send(String to, String subject, String text) {
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.info("SMTP não configurado: e-mail \"{}\" para {} não foi enviado.", subject, to);
            return;
        }
        CompletableFuture.runAsync(() -> {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(props.mail().from());
                message.setTo(to);
                message.setSubject(subject);
                message.setText(text);
                sender.send(message);
            } catch (Exception e) {
                log.error("Falha ao enviar e-mail para {}: {}", to, e.getMessage());
            }
        });
    }
}
