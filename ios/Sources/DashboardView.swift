import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var state: AppState
    @StateObject private var health = HealthManager()
    @State private var now = Date()

    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                header
                FastingCard(now: now)
                PillarsCard(health: health)
                StreakRow(health: health)
                healthFooter
            }
            .padding(16)
        }
        .background(Color.bg.ignoresSafeArea())
        .onReceive(ticker) { now = $0 }
        .task {
            await health.requestAuthorization()
            syncMotion()
        }
        .onChange(of: health.todaySteps) { _ in syncMotion() }
        .onChange(of: scenePhaseRefreshKey) { _ in
            Task { await health.refresh(); syncMotion() }
        }
    }

    // Re-pull Health when the app returns to the foreground.
    @Environment(\.scenePhase) private var scenePhase
    private var scenePhaseRefreshKey: Int { scenePhase == .active ? 1 : 0 }

    private func syncMotion() {
        if health.authorized, health.todaySteps >= health.motionStepGoal {
            state.setDone("motion", true)
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("Daily Protocol")
                .font(.system(size: 26, weight: .bold))
                .foregroundColor(.white)
            Text(Date().formatted(.dateTime.weekday(.wide).month(.wide).day()))
                .font(.system(size: 12))
                .foregroundColor(.muted)
                .textCase(.uppercase)
                .tracking(1.5)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 8)
    }

    private var healthFooter: some View {
        VStack(spacing: 6) {
            if !health.available {
                Text("Apple Health is unavailable on this device.")
                    .foregroundColor(.muted)
            } else if !health.authorized {
                Button("Connect Apple Health") {
                    Task { await health.requestAuthorization(); syncMotion() }
                }
                .foregroundColor(.accent)
            } else {
                Text("\(health.todaySteps) steps · \(health.todayEnergy) kcal active today")
                    .foregroundColor(.muted)
                Text("Motion auto-completes at \(health.motionStepGoal) steps")
                    .foregroundColor(.faint)
            }
        }
        .font(.system(size: 11))
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }
}

// MARK: - Fasting

struct FastingCard: View {
    @EnvironmentObject var state: AppState
    let now: Date

    private var elapsed: TimeInterval {
        state.fastStart.map { now.timeIntervalSince($0) } ?? 0
    }
    private var goalSeconds: TimeInterval { Double(state.goalHours) * 3600 }
    private var fraction: Double {
        state.fastStart == nil ? 0 : min(1, elapsed / goalSeconds)
    }
    private var complete: Bool {
        state.fastStart != nil && elapsed >= goalSeconds
    }

    var body: some View {
        Card {
            HStack {
                Text("Fasting Window").cardTitle()
                Spacer()
                HStack(spacing: 6) {
                    Text("Goal").font(.system(size: 12)).foregroundColor(.faint)
                    stepper("−") { state.adjustGoal(-1) }
                    Text("\(state.goalHours)h")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(.white)
                    stepper("+") { state.adjustGoal(1) }
                }
            }

            ZStack {
                Circle().stroke(Color.border, lineWidth: 14)
                Circle()
                    .trim(from: 0, to: fraction)
                    .stroke(complete ? Color.green : Color.accent,
                            style: StrokeStyle(lineWidth: 14, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.5), value: fraction)
                VStack(spacing: 2) {
                    Text(Self.clock(elapsed))
                        .font(.system(size: 34, weight: .semibold, design: .monospaced))
                        .monospacedDigit()
                        .foregroundColor(.white)
                    Text("of \(state.goalHours)h goal")
                        .font(.system(size: 12)).foregroundColor(.muted)
                    if state.fastStart != nil {
                        Text("\(Int(fraction * 100))%")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.accent)
                    }
                }
            }
            .frame(width: 200, height: 200)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)

            Text(statusText)
                .font(.system(size: 13))
                .foregroundColor(complete ? .green : .muted)
                .frame(maxWidth: .infinity, minHeight: 18)

            Button(action: { state.toggleFast() }) {
                Text(state.fastStart == nil ? "Start Fast" : "End Fast")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundColor(state.fastStart == nil ? Color.ink : Color.muted)
                    .background(state.fastStart == nil ? Color.accent : Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(state.fastStart == nil ? Color.clear : Color.border)
                    )
                    .cornerRadius(12)
            }
            .buttonStyle(.plain)
        }
    }

    private func stepper(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(symbol)
                .font(.system(size: 15))
                .frame(width: 22, height: 22)
                .background(Color.border)
                .foregroundColor(.white)
                .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }

    private var statusText: String {
        guard state.fastStart != nil else { return "Not fasting" }
        if complete {
            return "Goal reached! +\(Self.clock(elapsed - goalSeconds)) past \(state.goalHours)h"
        }
        return "\(Self.clock(goalSeconds - elapsed)) until \(state.goalHours)h goal"
    }

    private static func clock(_ interval: TimeInterval) -> String {
        let s = max(0, Int(interval))
        return String(format: "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }
}

// MARK: - Pillars

struct PillarsCard: View {
    @EnvironmentObject var state: AppState
    @ObservedObject var health: HealthManager

    var body: some View {
        Card {
            Text("Daily Pillars").cardTitle()

            ForEach(Pillars.all) { pillar in
                PillarRow(pillar: pillar, done: state.isDone(pillar.id)) {
                    state.toggle(pillar.id)
                    if pillar.id == "breath", state.isDone("breath") {
                        Task { await health.logMindful(minutes: 5) }
                    }
                }
            }

            ProgressView(value: Double(state.completedToday),
                         total: Double(Pillars.all.count))
                .tint(.green)
                .padding(.top, 12)

            Text(countText)
                .font(.system(size: 12))
                .foregroundColor(.muted)
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
        }
    }

    private var countText: String {
        state.completedToday == Pillars.all.count
            ? "✓ All pillars complete — nice work"
            : "\(state.completedToday) of \(Pillars.all.count) complete"
    }
}

struct PillarRow: View {
    let pillar: Pillar
    let done: Bool
    let tap: () -> Void

    var body: some View {
        Button(action: tap) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(done ? Color.green : Color.clear)
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(done ? Color.green : Color.faint, lineWidth: 2)
                    if done {
                        Image(systemName: "checkmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.ink)
                    }
                }
                .frame(width: 26, height: 26)

                Text(pillar.emoji).font(.system(size: 18)).frame(width: 22)

                Text(pillar.label)
                    .font(.system(size: 15))
                    .foregroundColor(done ? .muted : .white)
                    .strikethrough(done, color: .faint)

                Spacer()

                if pillar.auto && done {
                    Image(systemName: "heart.fill")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                }
            }
            .padding(.vertical, 13)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Streak / stats

struct StreakRow: View {
    @EnvironmentObject var state: AppState
    @ObservedObject var health: HealthManager

    var body: some View {
        HStack(spacing: 14) {
            StatBox(value: "\(state.streak)", suffix: " 🔥", label: "Day Streak")
            StatBox(value: "\(state.bestFastHours)", suffix: "h", label: "Best Fast")
            StatBox(value: "\(health.todaySteps)", suffix: "", label: "Steps Today")
        }
    }
}

struct StatBox: View {
    let value: String
    let suffix: String
    let label: String

    var body: some View {
        VStack(spacing: 8) {
            (Text(value).font(.system(size: 26, weight: .bold))
                + Text(suffix).font(.system(size: 16)))
                .foregroundColor(.white)
            Text(label)
                .font(.system(size: 11))
                .foregroundColor(.muted)
                .textCase(.uppercase)
                .tracking(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color.elev)
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.border))
        .cornerRadius(14)
    }
}
