import { isAndroid } from './nativeBridge'
import { nativeAdapter } from './nativeAdapter'
import { fastApiAdapter } from './fastApiAdapter'

/**
 * Platform-agnostic Hardware facade.
 *
 * The pages call `Hardware.scanWifi()`, `Hardware.ping()`, … and never need to
 * know whether they run on Windows (FastAPI backend) or inside the Android app
 * (native bridge). The correct adapter is chosen once, at load, by feature-
 * detecting the injected native interface.
 *
 * Usage:
 *   import Hardware from '../hardware'
 *   const reading = await Hardware.currentWifi()
 *   const ping = await Hardware.ping('8.8.8.8', 4)
 */
const adapter = isAndroid() ? nativeAdapter : fastApiAdapter

export const Hardware = {
  /** 'android' | 'web' — handy for platform-specific copy or hiding features. */
  platform: isAndroid() ? 'android' : 'web',
  ...adapter,
}

export default Hardware
