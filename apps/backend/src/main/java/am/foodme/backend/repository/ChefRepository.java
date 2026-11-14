package am.foodme.backend.repository;

import am.foodme.backend.model.Chef;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ChefRepository extends JpaRepository<Chef, Long> {
    // Recalculating the rating locks the chef row, so two ratings saved at the
    // same moment can't each compute an average that misses the other one.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Chef c where c.id = :id")
    Optional<Chef> findByIdForUpdate(@Param("id") Long id);

    Page<Chef> findByStatusOrderByPriorityIndexAscIdAsc(String status, Pageable pageable);

    Optional<Chef> findByUsername(String username);

    Page<Chef> findByUsernameContainingIgnoreCase(String q, Pageable pageable);
}
