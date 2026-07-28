package com.evnict.tabletennis.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class JsonConverters {
    private static final ObjectMapper mapper = new ObjectMapper();

    @Converter
    public static class StringListConverter implements AttributeConverter<List<String>, String> {
        @Override
        public String convertToDatabaseColumn(List<String> attribute) {
            return attribute == null ? null : String.join(",", attribute);
        }
        @Override
        public List<String> convertToEntityAttribute(String dbData) {
            if (dbData == null || dbData.trim().isEmpty()) {
                return new ArrayList<>();
            }
            return new ArrayList<>(java.util.Arrays.asList(dbData.split(",")));
        }
    }

    @Converter
    public static class ObjectListConverter implements AttributeConverter<List<Object>, String> {
        @Override
        public String convertToDatabaseColumn(List<Object> attribute) {
            try {
                return attribute == null ? null : mapper.writeValueAsString(attribute);
            } catch (JsonProcessingException e) {
                return "[]";
            }
        }
        @Override
        public List<Object> convertToEntityAttribute(String dbData) {
            try {
                return dbData == null || dbData.isEmpty() ? new ArrayList<>() : mapper.readValue(dbData, new TypeReference<List<Object>>() {});
            } catch (IOException e) {
                return new ArrayList<>();
            }
        }
    }
}
