package com.evnict.tabletennis;

import com.evnict.tabletennis.entity.Member;
import com.evnict.tabletennis.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Component
public class DatabaseInitializer implements CommandLineRunner {

    @Autowired
    private MemberRepository memberRepository;

    @Override
    public void run(String... args) throws Exception {
        if (memberRepository.count() == 0) {
            System.out.println("Initializing EVNICT Member Database...");
            List<Member> members = new ArrayList<>();

            // 1. Nguyễn Dương Mạnh Dũng
            members.add(createMember("u01", "Nguyễn Dương Mạnh Dũng", "Nam", "TTPM", "0848907219", "dungndm.evnit@evn.com.vn", "A0", 1850));
            // 2. Trần Văn Ninh
            members.add(createMember("u02", "Trần Văn Ninh", "Nam", "Phòng TKDV", "0904554596", "ninhtv.evnit@evn.com.vn", "A1", 1700, List.of("admin", "player")));
            // 3. Hồ Trung Công
            members.add(createMember("u03", "Hồ Trung Công", "Nam", "TTPM", "0326542734", "conght.evnit@evn.com.vn", "A1", 1700, List.of("admin", "player")));
            // 4. Đỗ Văn Nghĩa
            members.add(createMember("u04", "Đỗ Văn Nghĩa", "Nam", "TTPM", "0989198768", "nghiadv.evnit@evn.com.vn", "A1", 1700));
            // 5. Đỗ Văn Trang
            members.add(createMember("u05", "Đỗ Văn Trang", "Nam", "TTHT", "0963616888", "trangdv.evnit@evn.com.vn", "A1", 1700));
            // 6. Nguyễn Văn Công
            members.add(createMember("u06", "Nguyễn Văn Công", "Nam", "TTHT", "0962626216", "congnv.evnit@evn.com.vn", "A1", 1700));
            // 7. Nguyễn Long Anh
            members.add(createMember("u07", "Nguyễn Long Anh", "Nam", "TTANTT", "0962333297", "Anhnl2.evnit@evn.com.vn", "A1", 1700));
            // 8. Nguyễn Việt Thắng
            members.add(createMember("u08", "Nguyễn Việt Thắng", "Nam", "TTANTT", "0963998993", "thangnv.evnit@evn.com.vn", "A2", 1550));
            // 9. Vũ Thế Anh
            members.add(createMember("u09", "Vũ Thế Anh", "Nam", "Ban ĐTXD EVN", "0963598666", "anhvt@evn.com.vn", "A2", 1550));
            // 10. Trần Minh Hưởng
            members.add(createMember("u10", "Trần Minh Hưởng", "Nam", "TTPM", "0962033369", "huongtm@evn.com.vn", "A2", 1550));
            // 11. Phan Thế Đại
            members.add(createMember("u11", "Phan Thế Đại", "Nam", "Ban KHCN&CĐS EVN", "0966633388", "daipt@evn.com.vn", "A2", 1550));
            // 12. Vũ Minh Thành
            members.add(createMember("u12", "Vũ Minh Thành", "Nam", "TTHT", "0963214705", "thanhvm.evnit@evn.com.vn", "A3", 1400));
            // 13. Trần Hồng Dương
            members.add(createMember("u13", "Trần Hồng Dương", "Nam", "KT", "0966181999", "duongth@evn.com.vn", "A3", 1400));
            // 14. Ngô Thị Hồng Ngọc
            members.add(createMember("u14", "Ngô Thị Hồng Ngọc", "Nữ", "TCHC", "0968110986", "ngocth.evnit@evn.com.vn", "A3", 1400, List.of("admin", "player")));
            // 15. Lại Thế Hùng
            members.add(createMember("u15", "Lại Thế Hùng", "Nam", "TTHT", "0966807777", "hunglt.evnit@evn.com.vn", "A3", 1400));
            // 16. Trịnh Thị Nghĩa Bình
            members.add(createMember("u16", "Trịnh Thị Nghĩa Bình", "Nữ", "TTPM", "0947859059", "binhttn.evnit@evn.com.vn", "A3", 1400));
            // 17. Khổng Thị Ngọc Hải
            members.add(createMember("u17", "Khổng Thị Ngọc Hải", "Nữ", "TTPM", "0973577481", "haiktn.evnit@evn.com.vn", "A4", 1200));
            // 18. Nguyễn Hùng Minh
            members.add(createMember("u18", "Nguyễn Hùng Minh", "Nam", "Ban Hưu trí", "0963606268", "HungNM@huutri.com.vn", "A4", 1200));
            // 19. Đặng Thanh Xuân
            members.add(createMember("u19", "Đặng Thanh Xuân", "Nam", "Ban KDMBĐ EVN", "0966653356", "xuandk@evn.com.vn", "A4", 1200));
            // 20. Đỗ Minh Hà
            members.add(createMember("u20", "Đỗ Minh Hà", "Nam", "Ban QLXD EVN", "0912380327", "hadm@evn.com.vn", "A3", 1400));
            // 21. Nguyễn Thị Hải Hà
            members.add(createMember("u21", "Nguyễn Thị Hải Hà", "Nữ", "TTPM", "0966181666", "hanh.evnit@evn.com.vn", "A5", 1000));

            memberRepository.saveAll(members);
            System.out.println("EVNICT Member Database successfully initialized with 21 members.");
        }
    }

    private Member createMember(String id, String fullName, String gender, String department, String phone, String email, String rank, int elo) {
        return createMember(id, fullName, gender, department, phone, email, rank, elo, List.of("player"));
    }

    private Member createMember(String id, String fullName, String gender, String department, String phone, String email, String rank, int elo, List<String> roles) {
        Member m = new Member();
        m.setId(id);
        m.setFullName(fullName);
        m.setGender(gender);
        m.setDepartment(department);
        m.setPhone(phone);
        m.setEmail(email);
        m.setUsername(email.split("@")[0]);
        m.setRankTier(rank);
        m.setElo(elo);
        m.setRoles(roles);
        m.setJoinedAt(LocalDate.now());
        m.setIsActive(true);
        m.setPassword("123456");
        return m;
    }
}
