/**
 * Public endpoints of the RepCast backend (repcast-backend stack outputs, ap-south-1).
 * The AppSync key is a public client key: it only allows publishing to and subscribing on
 * session channels, and it expires (rotated on each backend deploy).
 */
export const config = {
  apiUrl: 'https://btr6ft64w1.execute-api.ap-south-1.amazonaws.com',
  eventsHttpHost: 'tfqlk5yeirbcpjecqsdq775ic4.appsync-api.ap-south-1.amazonaws.com',
  eventsRealtimeHost: 'tfqlk5yeirbcpjecqsdq775ic4.appsync-realtime-api.ap-south-1.amazonaws.com',
  eventsApiKey: 'da2-g4deiumcerfwzdyxlr3igkm7n4',
  /** Where the phone camera app is hosted. */
  cameraAppUrl: 'https://mallikarjuntr.github.io/repcast-tv-app/',
  /**
   * What the TV's QR code opens (with ?code=…) and the address it shows: a short link on the
   * website (repcast-tv-landing-page netlify.toml) that opens the camera page at
   * repcast.netlify.app/camera/, which Netlify serves from cameraAppUrl.
   */
  pairUrl: 'https://repcast.netlify.app/go',
  /**
   * An automatic AI note on every receipt (POST {apiUrl}/coach-note). Off: the receipt keeps RepCast's
   * own instant note, and the AI coach writes on request instead ("Analyse with AI", POST /coach/analysis).
   */
  aiCoach: false,
} as const;
