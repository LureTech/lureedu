package br.com.lure.growth.community;

import br.com.lure.growth.common.CommentDto;
import br.com.lure.growth.user.AuthorDto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CommunityDtos {

    private CommunityDtos() {
    }

    /** {@code recentComments}: os 2 comentários mais novos (do mais antigo pro mais novo) — prévia no feed. */
    public record PostDto(UUID id, String category, String body, String imageUrl, Integer imageWidth,
                          Integer imageHeight, long likesCount, long commentsCount, boolean likedByMe,
                          Instant createdAt, AuthorDto author, boolean canDelete, List<CommentDto> recentComments) {
    }

    public record LikeResponse(boolean liked, long likesCount) {
    }

    /** {@code authors}: até 3 autores (distintos) das publicações novas, para o aviso "N posts novos". */
    public record NewCountResponse(long count, List<AuthorDto> authors) {
    }

    public record TagCount(String tag, long n) {
    }

    /** Quem mais movimentou a comunidade nos últimos 7 dias. */
    public record VoiceDto(AuthorDto author, long posts, long comments) {
    }

    public record CommunityStatsDto(long members, long postsToday, long postsTotal, long myPosts24h,
                                    long remainingToday, List<TagCount> tags, List<VoiceDto> topVoices) {
    }
}
