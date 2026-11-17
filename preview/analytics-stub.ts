// Local preview only: logs Journeys events instead of sending them.
const log = (name: string) => async (input?: unknown) => {
  console.debug('[journeys]', name, input ?? '');
  return { journeyId: 'preview' };
};
export const telemetry = {
  appReady: log('appReady'),
  startJourney: log('startJourney'),
  progress: log('progress'),
  interaction: log('interaction'),
  endJourney: log('endJourney'),
};
