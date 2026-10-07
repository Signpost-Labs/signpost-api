import { createPromiscopeClient } from './index.js';

const client = createPromiscopeClient({
  baseUrl: 'https://api.promiscope.example/api',
  accessToken: 'your-access-token',
});

export async function listPlayers(region: string) {
  return client.GET('/players', {
    params: { query: { region, page: 1 } },
  });
}
