import SwiftUI
import Charts

/// One day's roll-up used by the 30-day charts.
struct DayStat: Identifiable {
    let id: String      // day key, e.g. "2026-06-28"
    let date: Date
    let pillarsComplete: Int
    let fastingHours: Double
}

struct HistoryCard: View {
    @EnvironmentObject var state: AppState

    var body: some View {
        let stats = state.last30Days()
        Card {
            Text("Last 30 Days").cardTitle()

            sectionLabel("Pillars completed")
            Chart(stats) { day in
                BarMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Pillars", day.pillarsComplete)
                )
                .cornerRadius(2)
                .foregroundStyle(day.pillarsComplete == Pillars.all.count ? Color.green : Color.accent)
            }
            .chartYScale(domain: 0...Pillars.all.count)
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(values: [0, 2, 4]) { _ in
                    AxisValueLabel().foregroundStyle(Color.muted)
                    AxisGridLine().foregroundStyle(Color.border)
                }
            }
            .frame(height: 90)

            sectionLabel("Fasting hours")
            Chart(stats) { day in
                BarMark(
                    x: .value("Day", day.date, unit: .day),
                    y: .value("Hours", day.fastingHours)
                )
                .cornerRadius(2)
                .foregroundStyle(day.fastingHours >= Double(state.goalHours) ? Color.green : Color.accent)

                RuleMark(y: .value("Goal", Double(state.goalHours)))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                    .foregroundStyle(Color.faint)
            }
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks { _ in
                    AxisValueLabel().foregroundStyle(Color.muted)
                    AxisGridLine().foregroundStyle(Color.border)
                }
            }
            .frame(height: 90)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 4)
    }
}
