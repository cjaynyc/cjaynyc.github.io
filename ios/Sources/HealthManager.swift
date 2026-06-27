import Foundation
import HealthKit

/// Bridges Apple Health into the app: reads today's activity and writes
/// breathwork as Mindful Minutes.
@MainActor
final class HealthManager: ObservableObject {
    @Published private(set) var available = HKHealthStore.isHealthDataAvailable()
    @Published private(set) var authorized = false
    @Published private(set) var todaySteps = 0
    @Published private(set) var todayEnergy = 0

    /// Step count at which the "Motion" pillar auto-completes.
    let motionStepGoal = 6000

    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        [HKQuantityType(.stepCount),
         HKQuantityType(.activeEnergyBurned),
         HKQuantityType(.distanceWalkingRunning)]
    }

    private var shareTypes: Set<HKSampleType> {
        [HKCategoryType(.mindfulSession)]
    }

    // MARK: Authorization

    func requestAuthorization() async {
        guard available else { return }
        do {
            try await store.requestAuthorization(toShare: shareTypes, read: readTypes)
            authorized = true
            await refresh()
        } catch {
            print("HealthKit authorization failed: \(error.localizedDescription)")
        }
    }

    // MARK: Reads

    func refresh() async {
        guard available else { return }
        async let steps = sumToday(HKQuantityType(.stepCount), unit: .count())
        async let energy = sumToday(HKQuantityType(.activeEnergyBurned), unit: .kilocalorie())
        todaySteps = Int(await steps)
        todayEnergy = Int(await energy)
    }

    private func sumToday(_ type: HKQuantityType, unit: HKUnit) async -> Double {
        let start = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)
        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(quantityType: type,
                                          quantitySamplePredicate: predicate,
                                          options: .cumulativeSum) { _, stats, _ in
                continuation.resume(returning: stats?.sumQuantity()?.doubleValue(for: unit) ?? 0)
            }
            store.execute(query)
        }
    }

    // MARK: Writes

    /// Logs a Mindful Minutes session — called when the breathwork pillar is checked.
    func logMindful(minutes: Int) async {
        guard available else { return }
        let type = HKCategoryType(.mindfulSession)
        let end = Date()
        let start = Calendar.current.date(byAdding: .minute, value: -minutes, to: end) ?? end
        let sample = HKCategorySample(type: type,
                                      value: HKCategoryValue.notApplicable.rawValue,
                                      start: start, end: end)
        do {
            try await store.save(sample)
        } catch {
            print("Mindful session save failed: \(error.localizedDescription)")
        }
    }
}
