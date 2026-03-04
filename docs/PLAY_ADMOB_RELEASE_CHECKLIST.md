# Play + AdMob Release Checklist

This project includes build-time checks to reduce production mistakes:
- Production builds fail if `ADMOB_ANDROID_APP_ID` or `ADMOB_REWARDED_AD_UNIT_ID` is missing.
- Production builds fail if AdMob test IDs are used.

## 1. Build artifacts
- Use AAB for Play upload:
  - `npm run android:release:aab`
- Use APK only for device QA:
  - `npm run android:release:apk`

## 2. Size checks
- Generate size report:
  - `npm run android:size`
- Confirm no unexpected large assets are added.
- Keep release minification and shrinking enabled (`android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true`).

## 3. AdMob checks
- Real AdMob IDs in production env:
  - `ADMOB_ANDROID_APP_ID`
  - `ADMOB_REWARDED_AD_UNIT_ID`
- Do not ship Google test IDs in production.
- Verify rewarded ad flow on at least:
  - 1 fresh install
  - 1 returning user
  - poor network conditions

## 4. Play Console checks
- Target SDK and policy declarations up to date.
- Data safety form matches actual data usage.
- Privacy policy URL is valid and public.
- App signing and integrity configured.
- Pre-launch report passes critical issues.

## 5. Functional smoke test
- Cold launch goes directly to UI without extra app-logo hold.
- Open local video from file picker and external file intent.
- AI analysis:
  - rewarded ad path
  - ad unavailable fallback path
  - result rendering and close behavior
- Landscape controls:
  - AI button tappable
  - zoom panel selectable/scrollable

