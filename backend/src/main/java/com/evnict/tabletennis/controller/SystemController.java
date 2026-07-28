package com.evnict.tabletennis.controller;

import com.evnict.tabletennis.entity.*;
import com.evnict.tabletennis.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api")
public class SystemController {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MatchRecordRepository matchRecordRepository;

    @Autowired
    private ChallengeRequestRepository challengeRequestRepository;

    @Autowired
    private AppNotificationRepository notificationRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    // --- AUTHENTICATION ---
    @PostMapping("/auth/login")
    public ResponseEntity<?> login(
            @RequestParam(required = false) String identifier,
            @RequestParam(required = false) String email,
            @RequestParam String password
    ) {
        String loginId = identifier;
        if (loginId == null || loginId.trim().isEmpty()) {
            loginId = email;
        }
        if (loginId == null || loginId.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Vui lòng nhập Username hoặc Email.");
        }

        Optional<Member> memberOpt = findByIdentifier(loginId);
        if (memberOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("Username hoặc Email không tồn tại trong hệ thống.");
        }

        Member member = memberOpt.get();
        if (!Boolean.TRUE.equals(member.getIsActive())) {
            return ResponseEntity.badRequest().body("Tài khoản của bạn chưa được phê duyệt bởi Admin.");
        }
        if (member.getPassword() != null && !member.getPassword().equals(password)) {
            return ResponseEntity.badRequest().body("Mật khẩu không chính xác.");
        }
        return ResponseEntity.ok(member);
    }

    @PostMapping("/auth/register")
    public ResponseEntity<?> register(@RequestBody Member member) {
        String normalizedEmail = member.getEmail() == null ? "" : member.getEmail().trim().toLowerCase(Locale.ROOT);
        if (normalizedEmail.isEmpty()) {
            return ResponseEntity.badRequest().body("Email không hợp lệ.");
        }
        if (memberRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return ResponseEntity.badRequest().body("Email đã tồn tại.");
        }

        String requestedUsername = normalizeUsername(member.getUsername());
        if (!requestedUsername.isEmpty() && memberRepository.existsByUsernameIgnoreCase(requestedUsername)) {
            return ResponseEntity.badRequest().body("Username đã tồn tại.");
        }
        String resolvedUsername = requestedUsername.isEmpty()
                ? nextAvailableUsername(generateUsernameBase(member.getFullName(), normalizedEmail))
                : requestedUsername;

        member.setId("u" + UUID.randomUUID().toString().substring(0, 8));
        member.setUsername(resolvedUsername);
        member.setEmail(normalizedEmail);
        member.setJoinedAt(LocalDate.now());
        member.setIsActive(false); // Wait for admin approval
        member.setElo(1200);
        member.setRankTier("A5");
        member.setRoles(java.util.List.of("player"));
        if (member.getPassword() == null || member.getPassword().isBlank()) {
            member.setPassword("123456");
        }
        Member saved = memberRepository.save(member);
        
        // Add audit log
        AuditLog log = new AuditLog();
        log.setId(UUID.randomUUID().toString());
        log.setTimestamp(LocalDateTime.now());
        log.setActorId("SYSTEM");
        log.setAction("REGISTER");
        log.setDetails("Đăng ký tài khoản thành viên mới: " + saved.getFullName());
        log.setReason("Đăng ký thành viên");
        auditLogRepository.save(log);

        return ResponseEntity.ok(saved);
    }

    // --- MEMBERS ---
    @GetMapping("/members")
    public List<Member> getMembers() {
        return memberRepository.findAll();
    }

    @PostMapping("/members/approve/{id}")
    public ResponseEntity<?> approveMember(@PathVariable String id, @RequestParam String actorId) {
        Optional<Member> memberOpt = memberRepository.findById(id);
        if (memberOpt.isEmpty()) return ResponseEntity.notFound().build();
        Member member = memberOpt.get();
        member.setIsActive(true);
        memberRepository.save(member);

        AuditLog log = new AuditLog();
        log.setId(UUID.randomUUID().toString());
        log.setTimestamp(LocalDateTime.now());
        log.setActorId(actorId);
        log.setAction("APPROVE_MEMBER");
        log.setDetails("Phê duyệt thành viên: " + member.getFullName());
        log.setReason("Phê duyệt tham gia CLB");
        auditLogRepository.save(log);

        return ResponseEntity.ok(member);
    }

    @PutMapping("/members/override/{id}")
    public ResponseEntity<?> overrideMemberStats(@PathVariable String id, @RequestParam Integer elo, @RequestParam String rank, @RequestParam String actorId, @RequestParam String reason) {
        Optional<Member> memberOpt = memberRepository.findById(id);
        if (memberOpt.isEmpty()) return ResponseEntity.notFound().build();
        Member member = memberOpt.get();
        String normalizedRank = normalizeRankTier(rank);
        
        String details = String.format("Ghi đè thông số của %s: Elo %d -> %d | Rank %s -> %s", 
            member.getFullName(), member.getElo(), elo, member.getRankTier(), normalizedRank);
        
        member.setElo(elo);
        member.setRankTier(normalizedRank);
        memberRepository.save(member);

        AuditLog log = new AuditLog();
        log.setId(UUID.randomUUID().toString());
        log.setTimestamp(LocalDateTime.now());
        log.setActorId(actorId);
        log.setAction("OVERRIDE_MEMBER");
        log.setDetails(details);
        log.setReason(reason);
        auditLogRepository.save(log);

        return ResponseEntity.ok(member);
    }

    @PostMapping("/members/{id}/change-password")
    public ResponseEntity<?> changePassword(@PathVariable String id, @RequestBody ChangePasswordRequest request) {
        Optional<Member> memberOpt = memberRepository.findById(id);
        if (memberOpt.isEmpty()) return ResponseEntity.notFound().build();

        if (request == null || request.newPassword == null || request.newPassword.trim().length() < 6) {
            return ResponseEntity.badRequest().body("Mật khẩu mới phải có ít nhất 6 ký tự.");
        }

        Member member = memberOpt.get();
        String oldPassword = request.oldPassword == null ? "" : request.oldPassword;
        if (member.getPassword() != null && !member.getPassword().equals(oldPassword)) {
            return ResponseEntity.badRequest().body("Mật khẩu hiện tại không chính xác.");
        }

        member.setPassword(request.newPassword.trim());
        memberRepository.save(member);

        AuditLog log = new AuditLog();
        log.setId(UUID.randomUUID().toString());
        log.setTimestamp(LocalDateTime.now());
        log.setActorId(id);
        log.setAction("CHANGE_PASSWORD");
        log.setDetails("Thành viên " + member.getFullName() + " đã cập nhật mật khẩu đăng nhập.");
        log.setReason("Người dùng tự đổi mật khẩu.");
        auditLogRepository.save(log);

        return ResponseEntity.ok("Đổi mật khẩu thành công.");
    }

    // --- MATCHES ---
    @GetMapping("/matches")
    public List<MatchRecord> getMatches() {
        return matchRecordRepository.findAll();
    }

    @Transactional
    @PostMapping("/matches/record")
    public ResponseEntity<?> recordMatch(@RequestBody MatchRecord match) {
        match.setId("m" + UUID.randomUUID().toString().substring(0, 8));
        match.setPlayedAt(LocalDateTime.now());
        match.setStatus("confirmed");
        
        if (match.getHomePlayerId() == null || match.getAwayPlayerId() == null
                || match.getHomePlayerId().isBlank() || match.getAwayPlayerId().isBlank()) {
            return ResponseEntity.badRequest().body("Thiếu thông tin người chơi cho trận đấu.");
        }

        if (match.getHomePlayerId().equals(match.getAwayPlayerId())) {
            return ResponseEntity.badRequest().body("Người chơi sân nhà và sân khách phải khác nhau.");
        }

        // Lock both members in deterministic order to prevent concurrent Elo lost-updates.
        List<String> playerIds = java.util.stream.Stream
                .of(match.getHomePlayerId(), match.getAwayPlayerId())
                .sorted(Comparator.naturalOrder())
                .toList();
        List<Member> lockedMembers = memberRepository.findAllByIdInForUpdate(playerIds);
        if (lockedMembers.size() != 2) {
            return ResponseEntity.badRequest().body("Không tìm thấy đầy đủ thông tin người chơi.");
        }

        Map<String, Member> memberById = new HashMap<>();
        for (Member member : lockedMembers) {
            memberById.put(member.getId(), member);
        }

        Member home = memberById.get(match.getHomePlayerId());
        Member away = memberById.get(match.getAwayPlayerId());
        if (home != null && away != null) {
            match.setHomeEloBefore(home.getElo());
            match.setAwayEloBefore(away.getElo());
            
            // Simple Elo formula implementation
            double expectedHome = 1.0 / (1.0 + Math.pow(10, (away.getElo() - home.getElo()) / 400.0));
            double expectedAway = 1.0 / (1.0 + Math.pow(10, (home.getElo() - away.getElo()) / 400.0));
            double homeOutcome = match.getHomeScore() > match.getAwayScore() ? 1.0 : (match.getHomeScore() < match.getAwayScore() ? 0.0 : 0.5);
            double awayOutcome = 1.0 - homeOutcome;
            
            int k = 32;
            int homeDiff = (int) Math.round(k * (homeOutcome - expectedHome));
            int awayDiff = (int) Math.round(k * (awayOutcome - expectedAway));
            
            int homeAfter = home.getElo() + homeDiff;
            int awayAfter = away.getElo() + awayDiff;
            
            match.setHomeEloAfter(homeAfter);
            match.setAwayEloAfter(awayAfter);
            
            home.setElo(homeAfter);
            away.setElo(awayAfter);
            memberRepository.save(home);
            memberRepository.save(away);
        } else {
            return ResponseEntity.badRequest().body("Không thể ánh xạ thông tin người chơi.");
        }
        
        MatchRecord saved = matchRecordRepository.save(match);
        return ResponseEntity.ok(saved);
    }

    // --- CHALLENGE REQUESTS ---
    @GetMapping("/challenges/{memberId}")
    public List<ChallengeRequest> getChallenges(@PathVariable String memberId) {
        return challengeRequestRepository.findByChallengerIdOrOpponentIdOrderByRequestedAtDesc(memberId, memberId);
    }

    @PostMapping("/challenges")
    public ResponseEntity<?> createChallenge(@RequestBody ChallengeRequest request) {
        request.setId("c" + UUID.randomUUID().toString().substring(0, 8));
        request.setRequestedAt(LocalDateTime.now());
        request.setStatus("pending");
        ChallengeRequest saved = challengeRequestRepository.save(request);

        // Send notification
        AppNotification notif = new AppNotification();
        notif.setId(UUID.randomUUID().toString());
        notif.setReceiverId(request.getOpponentId());
        notif.setCreatedAt(LocalDateTime.now());
        notif.setTitle("Lời Thách Đấu Mới");
        notif.setContent("Bạn nhận được một lời thách đấu từ thành viên khác. Vui lòng xem chi tiết tại Cổng thành viên.");
        notificationRepository.save(notif);

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/challenges/{id}/accept")
    public ResponseEntity<?> acceptChallenge(@PathVariable String id) {
        Optional<ChallengeRequest> opt = challengeRequestRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        ChallengeRequest req = opt.get();
        req.setStatus("accepted");
        challengeRequestRepository.save(req);
        return ResponseEntity.ok(req);
    }

    @PostMapping("/challenges/{id}/decline")
    public ResponseEntity<?> declineChallenge(@PathVariable String id) {
        Optional<ChallengeRequest> opt = challengeRequestRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        ChallengeRequest req = opt.get();
        req.setStatus("declined");
        challengeRequestRepository.save(req);
        return ResponseEntity.ok(req);
    }

    @PostMapping("/challenges/{id}/cancel")
    public ResponseEntity<?> cancelChallenge(@PathVariable String id) {
        Optional<ChallengeRequest> opt = challengeRequestRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        ChallengeRequest req = opt.get();
        req.setStatus("canceled");
        challengeRequestRepository.save(req);
        return ResponseEntity.ok(req);
    }

    // --- NOTIFICATIONS ---
    @GetMapping("/notifications/{memberId}")
    public List<AppNotification> getNotifications(@PathVariable String memberId) {
        return notificationRepository.findByReceiverIdOrderByCreatedAtDesc(memberId);
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<?> readNotification(@PathVariable String id) {
        Optional<AppNotification> opt = notificationRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        AppNotification notif = opt.get();
        notif.setIsRead(true);
        notificationRepository.save(notif);
        return ResponseEntity.ok(notif);
    }

    @PostMapping("/notifications")
    public ResponseEntity<?> createNotification(@RequestBody AppNotification notif) {
        if (notif.getId() == null) {
            notif.setId(UUID.randomUUID().toString());
        }
        if (notif.getCreatedAt() == null) {
            notif.setCreatedAt(LocalDateTime.now());
        }
        AppNotification saved = notificationRepository.save(notif);
        return ResponseEntity.ok(saved);
    }

    // --- AUDIT LOGS ---
    @GetMapping("/audit-logs")
    public List<AuditLog> getAuditLogs() {
        return auditLogRepository.findAllByOrderByTimestampDesc();
    }

    @PostMapping("/audit-logs")
    public ResponseEntity<?> createAuditLog(@RequestBody AuditLog log) {
        if (log.getId() == null || log.getId().isEmpty()) {
            log.setId("a" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (log.getTimestamp() == null) {
            log.setTimestamp(LocalDateTime.now());
        }
        AuditLog saved = auditLogRepository.save(log);
        return ResponseEntity.ok(saved);
    }

    private Optional<Member> findByIdentifier(String identifier) {
        String normalized = identifier == null ? "" : identifier.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }

        Optional<Member> byUsername = memberRepository.findByUsernameIgnoreCase(normalized);
        if (byUsername.isPresent()) {
            return byUsername;
        }

        return memberRepository.findByEmailIgnoreCase(normalized);
    }

    private String normalizeUsername(String username) {
        if (username == null) return "";
        return username.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }

    private String generateUsernameBase(String fullName, String email) {
        String emailLocalPart = email == null ? "" : email.split("@")[0];
        String namePart = fullName == null ? "" : fullName.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        String candidate = normalizeUsername(emailLocalPart);
        if (candidate.isEmpty()) {
            candidate = normalizeUsername(namePart);
        }
        if (candidate.isEmpty()) {
            candidate = "player";
        }
        return candidate;
    }

    private String nextAvailableUsername(String base) {
        String candidate = normalizeUsername(base);
        if (candidate.isEmpty()) {
            candidate = "player";
        }

        String next = candidate;
        int suffix = 1;
        while (memberRepository.existsByUsernameIgnoreCase(next)) {
            next = candidate + suffix;
            suffix += 1;
        }
        return next;
    }

    private String normalizeRankTier(String rank) {
        if (rank == null) {
            return "A5";
        }

        String normalized = rank.trim().toUpperCase(Locale.ROOT);
        switch (normalized) {
            case "A0":
            case "A1":
            case "A2":
            case "A3":
            case "A4":
            case "A5":
            case "A6":
                return normalized;
            // Backward-compatibility for old rank values.
            case "A+":
                return "A0";
            case "B":
                return "A1";
            case "A":
                return "A2";
            case "C":
                return "A3";
            case "D":
                return "A4";
            case "E":
                return "A5";
            default:
                return "A5";
        }
    }

    static class ChangePasswordRequest {
        public String oldPassword;
        public String newPassword;
    }
}
