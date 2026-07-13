import { useEffect, useState } from 'react';
import { startOfISOWeek, subWeeks, isSameDay } from 'date-fns';
import { supabase } from '../lib/supabase';

interface RecordData {
  distance_category: string;
  time_seconds: number;
}

export interface CheckinData {
  id: string;
  actual_duration_seconds: number | null;
  actual_distance_m: number | null;
  actual_pace_seconds_per_km: number | null;
  perceived_effort: number | null;
  notes: string | null;
  created_at: string;
  strava_activity_id: number | null;
  professor_feedback: string | null;
  professor_feedback_at: string | null;
  professor_feedback_seen_at: string | null;
  trainings: {
    title: string;
    distance_m: number | null;
    type: string;
  } | null;
}

export function useProgresso(studentId: string) {
  const [records, setRecords] = useState<Record<string, number>>({});
  const [streak, setStreak] = useState(0);
  const [paceHistory, setPaceHistory] = useState<{ label: string; pace: number }[]>([]);
  const [recentCheckins, setRecentCheckins] = useState<CheckinData[]>([]);
  const [allCheckins, setAllCheckins] = useState<CheckinData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const [recordsResponse, checkinsResponse] = await Promise.all([
          supabase.from('records').select('distance_category, time_seconds').eq('student_id', studentId).limit(50),
          supabase.from('checkins')
            .select('id, actual_duration_seconds, actual_distance_m, actual_pace_seconds_per_km, perceived_effort, notes, created_at, strava_activity_id, professor_feedback, professor_feedback_at, professor_feedback_seen_at, trainings(title, distance_m, type)')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
            .limit(100),
        ]);

        if (cancelled) return;

        if (recordsResponse.error) throw recordsResponse.error;
        if (checkinsResponse.error) throw checkinsResponse.error;

        const recordsData = recordsResponse.data as RecordData[];
        const checkinsData = checkinsResponse.data as CheckinData[];

        // Process records
        const recordsMap: Record<string, number> = {};
        recordsData.forEach((rec) => {
          recordsMap[rec.distance_category] = rec.time_seconds;
        });
        setRecords(recordsMap);

        // Recent checkins (first 5) + lista completa (já ordenada desc por created_at)
        setRecentCheckins(checkinsData.slice(0, 5));
        setAllCheckins(checkinsData);

        // Streak calculation
        const weekSet = new Set<string>();
        checkinsData.forEach((checkin) => {
          const date = new Date(checkin.created_at);
          const weekStart = startOfISOWeek(date);
          weekSet.add(weekStart.toISOString());
        });
        const weekDates = Array.from(weekSet).map((s) => new Date(s));
        weekDates.sort((a, b) => b.getTime() - a.getTime());

        const now = new Date();
        const currentWeekStart = startOfISOWeek(now);
        const previousWeekStart = subWeeks(currentWeekStart, 1);

        let streakCount = 0;
        if (weekDates.length > 0) {
          let startWeek: Date | null = null;
          for (const w of weekDates) {
            if (isSameDay(w, currentWeekStart) || isSameDay(w, previousWeekStart)) {
              startWeek = w;
              break;
            }
          }
          if (startWeek) {
            streakCount = 1;
            let nextWeek = subWeeks(startWeek, 1);
            while (weekDates.some((w) => isSameDay(w, nextWeek))) {
              streakCount++;
              nextWeek = subWeeks(nextWeek, 1);
            }
          }
        }
        setStreak(streakCount);

        // Pace history (only corrida)
        const corridaCheckins = checkinsData.filter(
          (c) => c.trainings && c.trainings.type === 'corrida'
        );
        const weekGroups: Record<
          string,
          { totalTime: number; totalDistance: number }
        > = {};
        corridaCheckins.forEach((c) => {
          const date = new Date(c.created_at);
          const weekStart = startOfISOWeek(date);
          const key = weekStart.toISOString();
          if (!weekGroups[key]) {
            weekGroups[key] = { totalTime: 0, totalDistance: 0 };
          }
          const time = c.actual_duration_seconds || 0;
          const dist = c.actual_distance_m || (c.trainings?.distance_m) || 0;
          
          weekGroups[key].totalTime += time;
          weekGroups[key].totalDistance += dist;
        });

        const sortedWeeks = Object.entries(weekGroups).sort(
          (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
        );
        const paceArr = sortedWeeks.map(([, data], index) => {
          if (data.totalDistance === 0) return { label: `Sem ${index + 1}`, pace: 0 };
          const pace = data.totalTime / (data.totalDistance / 1000);
          return { label: `Sem ${index + 1}`, pace: Math.round(pace) };
        }).filter(item => item.pace > 0);
        setPaceHistory(paceArr);
      } catch (e: unknown) {
        if (!cancelled) {
          if (e instanceof Error) {
            setError(e.message);
          } else {
            setError('An unexpected error occurred');
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const markFeedbackSeen = async (checkinId: string) => {
    const seenAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from('checkins')
      .update({ professor_feedback_seen_at: seenAt })
      .eq('id', checkinId);
    if (updErr) {
      console.error('Erro ao marcar feedback como visto:', updErr.message);
      return;
    }
    setRecentCheckins(cs => cs.map(c =>
      c.id === checkinId ? { ...c, professor_feedback_seen_at: seenAt } : c
    ));
    setAllCheckins(cs => cs.map(c =>
      c.id === checkinId ? { ...c, professor_feedback_seen_at: seenAt } : c
    ));
  };

  return { records, streak, paceHistory, recentCheckins, allCheckins, isLoading, error, markFeedbackSeen };
}
