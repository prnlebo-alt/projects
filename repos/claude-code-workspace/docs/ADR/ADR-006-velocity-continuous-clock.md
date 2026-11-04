# ADR-006 — Competitor Velocity Uses One Continuous Decay Clock

**Status:** Accepted

The v1.0 Candidate formula reset decay relative to the prior 90-day bucket and created a day-over-day discontinuity. Final v1.0 uses one continuous `exp(-days/45)` clock across 180 days and compares bucket-normalized intensities.
