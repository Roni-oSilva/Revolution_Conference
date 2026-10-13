// Baixa o binário do PostgREST usado SOMENTE nos testes de integração (não faz parte do site).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
const V = 'v12.2.3';
mkdirSync('.tools', { recursive: true });
if (!existsSync('.tools/postgrest')) {
  execSync(`curl -fsSL -o .tools/pgrst.tar.xz https://github.com/PostgREST/postgrest/releases/download/${V}/postgrest-${V}-linux-static-x64.tar.xz && tar -xJf .tools/pgrst.tar.xz -C .tools && rm .tools/pgrst.tar.xz`, { stdio: 'inherit' });
}
console.log('PostgREST pronto em .tools/postgrest');
