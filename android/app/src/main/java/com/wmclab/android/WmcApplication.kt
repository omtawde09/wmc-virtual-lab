package com.wmclab.android

import android.app.Application
import com.wmclab.android.di.AppContainer

/** Application entry point; owns the dependency container for its lifetime. */
class WmcApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
