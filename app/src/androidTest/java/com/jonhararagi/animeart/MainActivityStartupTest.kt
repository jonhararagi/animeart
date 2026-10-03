package com.jonhararagi.animeart

import android.content.Context
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MainActivityStartupTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()

    @After
    fun cleanupRecovery() {
        context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE).edit().clear().commit()
    }

    @Test
    fun mainActivityStartsWithoutCrash() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                check(!activity.isFinishing) { "MainActivity finished during startup" }
            }
        }
    }

    @Test
    fun mainActivitySurvivesCorruptRecoveryData() {
        context.getSharedPreferences("animeart_recovery", Context.MODE_PRIVATE)
            .edit()
            .putString("project", "{ definitely-not-valid-json")
            .commit()

        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                check(!activity.isFinishing) { "MainActivity finished with corrupt recovery data" }
            }
        }
    }
}
