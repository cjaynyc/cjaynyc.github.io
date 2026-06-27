import Foundation
import SwiftUI

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

// MARK: - App state (persisted to UserDefaults)

@MainActor
final class AppState: ObservableObject {
    @Published var fastStart: Date?
    @Published var goalHours: Int = 14
    @Published var bestFastHours: Int = 0
    @Published private(set) var pillarsByDay: [String: [String: Bool]] = [:]

    private let storeKey = "longevityStack.v1"

    private struct Snapshot: Codable {
        var fastStart: Date?
        var goalHours: Int
        var bestFastHours: Int
        var pillarsByDay: [String: [String: Bool]]
    }

    init() { load() }

    // MARK: Persistence

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: storeKey),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        fastStart = snap.fastStart
        goalHours = snap.goalHours
        bestFastHours = snap.bestFastHours
        pillarsByDay = snap.pillarsByDay
    }

    private func save() {
        let snap = Snapshot(fastStart: fastStart, goalHours: goalHours,
                            bestFastHours: bestFastHours, pillarsByDay: pillarsByDay)
        if let data = try? JSONEncoder().encode(snap) {
            UserDefaults.standard.set(data, forKey: storeKey)
        }
    }

    // MARK: Day keys

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar.current
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func dayKey(_ date: Date = Date()) -> String {
        dayFormatter.string(from: date)
    }

    static func prevDayKey(_ key: String) -> String {
        guard let d = dayFormatter.date(from: key),
              let p = Calendar.current.date(byAdding: .day, value: -1, to: d) else { return key }
        return dayFormatter.string(from: p)
    }

    // MARK: Pillars (with automatic midnight reset + history pruning)

    @discardableResult
    private func ensureToday() -> [String: Bool] {
        let key = AppState.dayKey()
        if pillarsByDay[key] == nil {
            pillarsByDay[key] = [:]
            pruneHistory()
            save()
        }
        return pillarsByDay[key] ?? [:]
    }

    func isDone(_ pillarID: String) -> Bool {
        pillarsByDay[AppState.dayKey()]?[pillarID] ?? false
    }

    func toggle(_ pillarID: String) {
        var rec = ensureToday()
        rec[pillarID] = !(rec[pillarID] ?? false)
        pillarsByDay[AppState.dayKey()] = rec
        save()
    }

    /// Set a pillar's state idempotently — used for Health-driven auto-completion.
    func setDone(_ pillarID: String, _ value: Bool) {
        var rec = ensureToday()
        guard rec[pillarID] != value else { return }
        rec[pillarID] = value
        pillarsByDay[AppState.dayKey()] = rec
        save()
    }

    var completedToday: Int {
        let rec = pillarsByDay[AppState.dayKey()] ?? [:]
        return Pillars.all.filter { rec[$0.id] == true }.count
    }

    private func isComplete(day: String) -> Bool {
        let rec = pillarsByDay[day] ?? [:]
        return Pillars.all.allSatisfy { rec[$0.id] == true }
    }

    /// Consecutive fully-complete days ending today (or yesterday if today isn't done yet).
    var streak: Int {
        var count = 0
        var key = AppState.dayKey()
        if !isComplete(day: key) { key = AppState.prevDayKey(key) }
        while isComplete(day: key) {
            count += 1
            key = AppState.prevDayKey(key)
        }
        return count
    }

    private func pruneHistory() {
        var keep: [String: [String: Bool]] = [:]
        var key = AppState.dayKey()
        for _ in 0..<30 {
            if let rec = pillarsByDay[key] { keep[key] = rec }
            key = AppState.prevDayKey(key)
        }
        pillarsByDay = keep
    }

    // MARK: Fasting

    func toggleFast() {
        if let start = fastStart {
            let hrs = Int(Date().timeIntervalSince(start) / 3600)
            if hrs > bestFastHours { bestFastHours = hrs }
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
}
