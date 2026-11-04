// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "PugCalculator",
    platforms: [
        .iOS(.v17),
        .macOS(.v13)
    ],
    products: [
        .library(name: "PugCalculatorCore", targets: ["PugCalculatorCore"])
    ],
    targets: [
        .target(name: "PugCalculatorCore"),
        .testTarget(name: "PugCalculatorCoreTests", dependencies: ["PugCalculatorCore"])
    ]
)
