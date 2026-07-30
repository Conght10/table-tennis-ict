package com.evnict.tabletennis.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.evnict.tabletennis.util.JsonConverters.ObjectListConverter;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
@Entity
@Table(name = "tournaments")
public class Tournament {
    @Id
    private String id;

    @JsonIgnore
    @Version
    @Column(name = "version", nullable = false)
    private Long rowVersion;

    @Column(name = "metadata_version", nullable = false)
    private Long metadataVersion = 0L;

    @Column(name = "competition_version", nullable = false)
    private Long competitionVersion = 0L;

    @Column(name = "registration_version", nullable = false)
    private Long registrationVersion = 0L;

    @Column(name = "draw_revision_current", nullable = false)
    private Integer drawRevisionCurrent = 0;
    
    @Column(nullable = false)
    private String name;
    
    @Column(nullable = false)
    private String type; // single, double, team
    
    @Column(name = "started_at", nullable = false)
    private LocalDate startedAt;
    
    @Column(name = "finished_at")
    private LocalDate finishedAt;
    
    private String status = "draft"; // draft, ongoing, finished
    
    @Column(name = "group_size")
    private Integer groupSize = 4;
    
    @Column(name = "team_size")
    private Integer teamSize = 3;
    
    private String stage = "group"; // group, knockout

    private String location;

    @Convert(converter = ObjectListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<Object> prizes;

    private String format = "group"; // group, round_robin

    @Transient
    private List<String> participants; // Member IDs list

    @Transient
    private List<Object> groups; // GroupAssignment list

    @Transient
    private List<Object> scores; // GroupMatchScore list

    @Transient
    private List<Object> knockoutMatches; // KnockoutMatch list

    @Transient
    private List<Object> teams; // Team list

    @Transient
    private List<String> captains; // Captain Member IDs list

    @Transient
    private List<Object> registrations;

    @Transient
    private List<Object> drawRevisions;

    @Transient
    private List<Object> seedOverrideHistory;

    @Transient
    private java.util.Map<String, Object> drawRules;

    @Transient
    private List<Object> manualTeamSlots;
}
