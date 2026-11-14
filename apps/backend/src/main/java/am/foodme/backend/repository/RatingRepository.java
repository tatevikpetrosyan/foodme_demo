package am.foodme.backend.repository;

import am.foodme.backend.model.Rating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RatingRepository extends JpaRepository<Rating, Long> {
    boolean existsByOrderId(Long orderId);

    Optional<Rating> findByOrderId(Long orderId);

    List<Rating> findByOrderIdIn(Collection<Long> orderIds);

    @Query("select avg(r.stars) from Rating r where r.chef.id = :chefId")
    Double averageStarsForChef(@Param("chefId") Long chefId);
}
