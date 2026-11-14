package am.foodme.backend.dto;

import am.foodme.backend.model.Rating;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RatingDto {
    private Integer stars;
    private String comment;
    private LocalDateTime createdAt;

    public static RatingDto mapEntityToDto(Rating entity) {
        if (entity == null) {
            return null;
        }
        return new RatingDto(entity.getStars(), entity.getComment(), entity.getCreatedAt());
    }
}
