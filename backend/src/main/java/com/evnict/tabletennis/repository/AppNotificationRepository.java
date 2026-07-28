package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.AppNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AppNotificationRepository extends JpaRepository<AppNotification, String> {
    List<AppNotification> findByReceiverIdOrderByCreatedAtDesc(String receiverId);
}
