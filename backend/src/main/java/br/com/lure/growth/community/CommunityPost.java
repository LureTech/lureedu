package br.com.lure.growth.community;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** Post da comunidade. O autor é sempre resolvido pelo perfil atual (nada de nome/foto duplicados aqui). */
@Entity
@Table(name = "community_posts")
public class CommunityPost {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 20)
    private String category;

    /** Pode ser vazio quando o post é só imagem. */
    @Column(nullable = false, length = 500)
    private String body;

    @Column(name = "image_path")
    private String imagePath;

    @Column(name = "image_width")
    private Integer imageWidth;

    @Column(name = "image_height")
    private Integer imageHeight;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CommunityPost() {
    }

    public CommunityPost(UUID userId, String category, String body, String imagePath, Integer imageWidth,
                         Integer imageHeight, Instant createdAt) {
        this.userId = userId;
        this.category = category;
        this.body = body;
        this.imagePath = imagePath;
        this.imageWidth = imageWidth;
        this.imageHeight = imageHeight;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getCategory() {
        return category;
    }

    public String getBody() {
        return body;
    }

    public String getImagePath() {
        return imagePath;
    }

    public Integer getImageWidth() {
        return imageWidth;
    }

    public Integer getImageHeight() {
        return imageHeight;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
