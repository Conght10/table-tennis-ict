-- Normalize legacy rank tiers to A0-A6 system
UPDATE members
SET rank_tier = CASE UPPER(TRIM(rank_tier))
    WHEN 'A+' THEN 'A0'
    WHEN 'B' THEN 'A1'
    WHEN 'A' THEN 'A2'
    WHEN 'C' THEN 'A3'
    WHEN 'D' THEN 'A4'
    WHEN 'E' THEN 'A5'
    ELSE rank_tier
END;

-- Fallback for null/invalid values
UPDATE members
SET rank_tier = 'A5'
WHERE rank_tier IS NULL
   OR TRIM(rank_tier) = ''
   OR UPPER(TRIM(rank_tier)) NOT IN ('A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6');