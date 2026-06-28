import Foundation
import SwiftUI
import WidgetKit

// MARK: - Pillars

struct Pillar: Identifiable, Hashable {
    let id: String
    let emoji: String
    let label: String
    /// Whether this pillar can be auto-completed from Apple Health data.
    let auto: Bool
}

enum Pillars {
    static let all: [Pillar] = [
        Pillar(id: "breath",  emoji: "🫁", label: "Kumbhaka Breathwork",       auto: false),
        Pillar(id: "ellagi",  emoji: "🍇", label: "Ellagitannin Intake",        auto: false),
        Pillar(id: "thermal", emoji: "🧊", label: "Cold / Hot Therapy",         auto: false),
        Pillar(id: "motion",  emoji: "🐕", label: "Motion (Walk with Earl)",    auto: true),
    ]
}

// MARK: - App state (persisted to the shared App Group store)

@MainActor
final class AppState: ObservableObject {
    @Published var fastStart: Date?
    @Published var goalHours: Int = 14
    @Published var bestFastHours: Int = 0
    @Published var motionStepGoal: Int = 6000
    @Published private(set) var pillarsByDay: [String: [String: Bool]] = [:]
    @Published private(set) var fastHistory: [FastRecord] = []

    init() {
        let snap = loadSnapshot()
        fastStart = snap.fastStart
        goalHours = snap.goalHours
        bestFastHours = snap.bestFastHours
        motionStepGoal = snap.motionStepGoal
        pillarsByDay = snap.pillarsByDay
        fastHistory = snap.fastHistory
    }

    private func save() {
        let snap = StackSnapshot(fastStart: fastStart,
                                 goalHours: goalHours,
                                 bestFastHours: bestFastHours,
                                 motionStepGoal: motionStepGoal,
                                 pillarsByDay: pillarsByDay,
                                 fastHistory: fastHistory)
        saveSnapshot(snap)
        WidgetCenter.shared.reloadAllTimelines()
    }

    /// Most recent completed fasts, newest first.
    var recentFasts: [FastRecord] {
        Array(fastHistory.suffix(7).reversed())
    }

    /// Per-day pillar completion and fasting hours for the last 30 days (oldest first).
    func last30Days() -> [DayStat] {
        var fastingByDay: [String: Double] = [:]
        for fast in fastHistory {
            let key = StackSnapshot.dayKey(fast.end)
            fastingByDay[key, default: 0] += fast.hours
        }

        var stats: [DayStat] = []
        var key = StackSnapshot.dayKey()
        for _ in 0..<30 {
            let rec = pillarsByDay[key] ?? [:]
            let complete = Pillars.all.filter { rec[$0.id] == true }.count
            let date = StackSnapshot.date(from: key) ?? Date()
            stats.append(DayStat(id: key, date: date,
                                 pillarsComplete: complete,
                                 fastingHours: fastingByDay[key] ?? 0))
            key = StackSnapshot.prevDayKey(key)
        }
        return stats.reversed()
    }

    // MARK: Pillars (with automatic midnight reset + history pruning)

    @discardableResult
    private func ensureToday() -> [String: Bool] {
        let key = StackSnapshot.dayKey()
        if pillarsByDay[key] == nil {
            pillarsByDay[key] = [:]
            pruneHistory()
            save()
        }
        return pillarsByDay[key] ?? [:]
    }

    func isDone(_ pillarID: String) -> Bool {
        pillarsByDay[StackSnapshot.dayKey()]?[pillarID] ?? false
    }

    func toggle(_ pillarID: String) {
        var rec = ensureToday()
        rec[pillarID] = !(rec[pillarID] ?? false)
        pillarsByDay[StackSnapshot.dayKey()] = rec
        save()
    }

    /// Set a pillar's state idempotently — used for Health-driven auto-completion.
    func setDone(_ pillarID: String, _ value: Bool) {
        var rec = ensureToday()
        guard rec[pillarID] != value else { return }
        rec[pillarID] = value
        pillarsByDay[StackSnapshot.dayKey()] = rec
        save()
    }

    var completedToday: Int {
        let rec = pillarsByDay[StackSnapshot.dayKey()] ?? [:]
        return Pillars.all.filter { rec[$0.id] == true }.count
    }

    private func isComplete(day: String) -> Bool {
        let rec = pillarsByDay[day] ?? [:]
        return Pillars.all.allSatisfy { rec[$0.id] == true }
    }

    /// Consecutive fully-complete days ending today (or yesterday if today isn't done yet).
    var streak: Int {
        var count = 0
        var key = StackSnapshot.dayKey()
        if !isComplete(day: key) { key = StackSnapshot.prevDayKey(key) }
        while isComplete(day: key) {
            count += 1
            key = StackSnapshot.prevDayKey(key)
        }
        return count
    }

    private func pruneHistory() {
        var keep: [String: [String: Bool]] = [:]
        var key = StackSnapshot.dayKey()
        for _ in 0..<30 {
            if let rec = pillarsByDay[key] { keep[key] = rec }
            key = StackSnapshot.prevDayKey(key)
        }
        pillarsByDay = keep
    }

    // MARK: Fasting

    func toggleFast() {
        if let start = fastStart {
            let end = Date()
            let hrs = Int(end.timeIntervalSince(start) / 3600)
            if hrs > bestFastHours { bestFastHours = hrs }
            // Record any fast of at least one minute.
            if end.timeIntervalSince(start) >= 60 {
                fastHistory.append(FastRecord(start: start, end: end))
                fastHistory = Array(fastHistory.suffix(60))   // keep storage bounded
            }
            fastStart = nil
        } else {
            fastStart = Date()
        }
        save()
    }

    func adjustGoal(_ delta: Int) {
        goalHours = min(36, max(8, goalHours + delta))
        save()
    }

    func adjustStepGoal(_ delta: Int) {
        motionStepGoal = min(20000, max(1000, motionStepGoal + delta))
        save()
    }
}
