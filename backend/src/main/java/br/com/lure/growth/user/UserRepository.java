package br.com.lure.growth.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByActiveTrue();

    long countByRole(Role role);

    /** Usado pelo filtro de segurança a cada requisição: busca só o necessário. */
    @Query("select u.active as active, u.role as role from User u where u.id = :id")
    Optional<AccessView> findAccessById(@Param("id") UUID id);

    @Query("""
            select u from User u
            where (:q = '' or lower(u.email) like concat('%', :q, '%')
                   or lower(coalesce(u.fullName, '')) like concat('%', :q, '%'))
            order by case when u.role = br.com.lure.growth.user.Role.ADMIN then 0 else 1 end, u.createdAt asc
            """)
    List<User> searchForAdmin(@Param("q") String q);

    interface AccessView {
        boolean getActive();

        Role getRole();
    }
}
