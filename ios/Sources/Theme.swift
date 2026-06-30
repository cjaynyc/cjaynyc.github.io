import SwiftUI

extension Color {
    init(hex: UInt) {
        self.init(.sRGB,
                  red:   Double((hex >> 16) & 0xff) / 255,
                  green: Double((hex >> 8)  & 0xff) / 255,
                  blue:  Double( hex        & 0xff) / 255,
                  opacity: 1)
    }

    static let bg     = Color(hex: 0x0f172a)
    static let elev   = Color(hex: 0x1e293b)
    static let border = Color(hex: 0x334155)
    static let faint  = Color(hex: 0x64748b)
    static let muted  = Color(hex: 0x94a3b8)
    static let accent = Color(hex: 0x38bdf8)
    static let green  = Color(hex: 0x34d399)
    static let ink    = Color(hex: 0x04223a) // dark text on bright buttons
}

/// Rounded elevated container matching the web app's `.card`.
struct Card<Content: View>: View {
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            content()
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.elev)
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.border))
        .cornerRadius(16)
    }
}

extension View {
    func cardTitle() -> some View {
        self.font(.system(size: 13, weight: .semibold))
            .foregroundColor(.muted)
            .textCase(.uppercase)
            .tracking(1)
    }
}
