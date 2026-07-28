package com.evnict.tabletennis.entity;

import com.evnict.tabletennis.util.JsonConverters.ObjectListConverter;
import com.evnict.tabletennis.util.JsonConverters.StringListConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.util.List;

@Data
@Entity
@Table(name = "tournament_states")
public class TournamentState {
    @Id
    @Column(name = "tournament_id")
    private String tournamentId;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> participants;

    @Convert(converter = ObjectListConverter.class)
    @Column(name = "`groups`", columnDefinition = "TEXT")
    private List<Object> groups;

    @Convert(converter = ObjectListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<Object> scores;

    @Convert(converter = ObjectListConverter.class)
    @Column(name = "knockout_matches", columnDefinition = "TEXT")
    private List<Object> knockoutMatches;

    @Convert(converter = ObjectListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<Object> teams;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> captains;
}
