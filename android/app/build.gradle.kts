plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.wmclab.android"
    // Android 16. If your installed SDK/AGP is older, drop these to 35 and bump
    // the Android Gradle Plugin instead of downgrading blindly.
    compileSdk = 36

    defaultConfig {
        applicationId = "com.wmclab.android"
        // 26 (Android 8.0) covers ~99% of devices and lets us ship a pure-XML
        // adaptive launcher icon (no raster fallback needed).
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
        debug {
            // Loads the WebView from the Vite dev server instead of bundled assets
            // when this flag is set (see MainActivity + BuildConfig.DEV_SERVER_URL).
            buildConfigField("String", "DEV_SERVER_URL", "\"\"")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.androidx.webkit)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
