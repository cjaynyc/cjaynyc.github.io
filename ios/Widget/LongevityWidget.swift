import WidgetKit
import SwiftUI

// MARK: - Timeline

struct LongevityEntry: TimelineEntry {
    let date: Date
    let snapshot: StackSnapshot
}

struct LongevityProvider: TimelineProvider {
    func placeholder(in context: Context) -> LongevityEntry {
        LongevityEntry(date: Date(), snapshot: loadSnapshot())
    }

    func getSnapshot(in context: Context, completion: @escaping (LongevityEntry) -> Void) {
        completion(LongevityEntry(date: Date(), snapshot: loadSnapshot()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LongevityEntry>) -> Void) {
        let entry = LongevityEntry(date: Date(), snapshot: loadSnapshot())
        // The live fast clock self-updates via Text(timerInterval:); refresh the
        // rest periodically so pillar counts / day rollover stay current.
        let refresh = Calendar.current.date(byAdding: .minute, value: 15, to: Date())
            ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

// MARK: - View

struct LongevityWidgetEntryView: View {
    var entry: LongevityEntry
    @Environment(\.widgetFamily) var family

    private var s: StackSnapshot { entry.snapshot }
    // Far-future end so the up-counting timer keeps running.
    private var fastRange: ClosedRange<Date>? {
        guard let start = s.fastStart else { return nil }
        return start...start.addingTimeInterval(48 * 3600)
    }

    var body: some View {
        switch family {
        case .accessoryCircular:    circularBody.widgetAccessoryBackground()
        case .accessoryRectangular: rectangularBody.widgetAccessoryBackground()
        case .accessoryInline:      inlineBody
        case .systemMedium:         mediumBody.widgetContainerBackground()
        default:                    smallBody.widgetContainerBackground()
        }
    }

    // MARK: Lock Screen / accessory families

    private var circularBody: some View {
        ZStack {
            AccessoryWidgetBackground()
            if s.fastStart != nil {
                Gauge(value: min(1, s.fastFraction)) {
                    Image(systemName: "timer")
                }
                .gaugeStyle(.accessoryCircularCapacity)
            } else {
                VStack(spacing: -1) {
                    Text("\(s.completedToday)").font(.system(size: 17, weight: .bold))
                    Text("/ \(StackSnapshot.pillarIDs.count)").font(.system(size: 9))
                }
            }
        }
    }

    private var rectangularBody: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let range = fastRange {
                HStack(spacing: 4) {
                    Image(systemName: "timer")
                    Text(timerInterval: range, countsDown: false)
                        .font(.system(.body, design: .monospaced))
                }
            } else {
                Label("Not fasting", systemImage: "moon.zzz")
            }
            Text("\(s.completedToday)/\(StackSnapshot.pillarIDs.count) pillars · 🔥\(s.streak)")
                .font(.caption)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inlineBody: some View {
        Text("🔥\(s.streak) · \(s.completedToday)/\(StackSnapshot.pillarIDs.count) pillars")
    }

    private var smallBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 5) {
                Image(systemName: "timer").font(.system(size: 11)).foregroundColor(.accent)
                Text("Longevity").font(.system(size: 12, weight: .semibold)).foregroundColor(.muted)
            }
            if let range = fastRange {
                Text(timerInterval: range, countsDown: false)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundColor(s.fastFraction >= 1 ? .green : .white)
                Text("of \(s.goalHours)h goal").font(.system(size: 11)).foregroundColor(.muted)
            } else {
                Text("No fast").font(.system(size: 20, weight: .bold)).foregroundColor(.white)
                Text("Tap to start").font(.system(size: 11)).foregroundColor(.muted)
            }
            Spacer(minLength: 0)
            HStack(spacing: 5) {
                Image(systemName: "checklist").font(.system(size: 11)).foregroundColor(.muted)
                Text("\(s.completedToday)/4 pillars")
                    .font(.system(size: 12, weight: .medium)).foregroundColor(.white)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var mediumBody: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().stroke(Color.border, lineWidth: 10)
                Circle()
                    .trim(from: 0, to: s.fastFraction)
                    .stroke(s.fastFraction >= 1 ? Color.green : Color.accent,
                            style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                if s.fastStart != nil {
                    Text("\(Int(s.fastFraction * 100))%")
                        .font(.system(size: 16, weight: .bold)).foregroundColor(.white)
                } else {
                    Image(systemName: "moon.zzz.fill").foregroundColor(.muted)
                }
            }
            .frame(width: 78, height: 78)

            VStack(alignment: .leading, spacing: 5) {
                Text("Daily Protocol")
                    .font(.system(size: 14, weight: .semibold)).foregroundColor(.white)
                if let range = fastRange {
                    Text(timerInterval: range, countsDown: false)
                        .font(.system(size: 15, weight: .semibold, design: .monospaced))
                        .foregroundColor(.muted)
                } else {
                    Text("Not fasting").font(.system(size: 13)).foregroundColor(.muted)
                }
                Text("\(s.completedToday) of 4 pillars done")
                    .font(.system(size: 13)).foregroundColor(.muted)
                Text("🔥 \(s.streak)-day streak")
                    .font(.system(size: 13)).foregroundColor(.muted)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

private extension View {
    @ViewBuilder
    func widgetContainerBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) { Color.bg }
        } else {
            self.padding(14).background(Color.bg)
        }
    }

    /// Lock Screen widgets render on a transparent, system-tinted background.
    @ViewBuilder
    func widgetAccessoryBackground() -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(for: .widget) { Color.clear }
        } else {
            self
        }
    }
}

// MARK: - Configuration

struct LongevityWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LongevityWidget", provider: LongevityProvider()) { entry in
            LongevityWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Longevity Stack")
        .description("Your fasting progress and pillar count at a glance.")
        .supportedFamilies([
            .systemSmall, .systemMedium,
            .accessoryCircular, .accessoryRectangular, .accessoryInline,
        ])
    }
}

@main
struct LongevityWidgetBundle: WidgetBundle {
    var body: some Widget {
        LongevityWidget()
    }
}
