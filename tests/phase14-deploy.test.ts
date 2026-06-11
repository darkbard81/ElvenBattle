import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Phase14 deployment assets', () => {
  it('keeps Docker and Nginx scoped to static dist serving', () => {
    const dockerfile = readFileSync('Dockerfile', 'utf8');
    const nginx = readFileSync('nginx.conf', 'utf8');
    const dockerignore = readFileSync('.dockerignore', 'utf8');

    expect(dockerfile).toContain('npm --silent run build');
    expect(dockerfile).toContain('/usr/share/nginx/html');
    expect(nginx).toContain('try_files $uri $uri/ /index.html');
    expect(nginx).toContain('Cache-Control');
    expect(dockerignore).toContain('node_modules');
    expect(dockerignore).toContain('dist');
  });
});
