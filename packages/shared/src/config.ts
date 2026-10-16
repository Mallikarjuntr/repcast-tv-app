/**
 * Public endpoints of the Spotter backend (spotter-backend stack outputs, ap-south-1).
 * The AppSync key is a public client key: it only allows publishing to and subscribing on
 * session channels, and it expires (rotated on each backend deploy).
 */
export const config = {
  apiUrl: 'https://btr6ft64w1.execute-api.ap-south-1.amazonaws.com',
  eventsHttpHost: 'tfqlk5yeirbcpjecqsdq775ic4.appsync-api.ap-south-1.amazonaws.com',
  eventsRealtimeHost: 'tfqlk5yeirbcpjecqsdq775ic4.appsync-realtime-api.ap-south-1.amazonaws.com',
  eventsApiKey: 'da2-g4deiumcerfwzdyxlr3igkm7n4',
  /** Where the phone camera app is hosted. */
  cameraAppUrl: 'https://mallikarjuntr.github.io/spotter-tv-app/',
  /**
   * What the TV's QR code opens (with ?code=1234) and the address it shows: a short link on the
   * website (spotter-tv-landing-page netlify.toml) that forwards to cameraAppUrl, keeping the code.
   */
  pairUrl: 'https://spotter-tv.netlify.app/go',
  /** POST {apiUrl}/coach-note (Claude on Amazon Bedrock). Off until the backend route is live. */
  aiCoach: false,
} as const;
