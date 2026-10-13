// Mensagens do painel via código na URL (nunca texto livre → sem "spoofing" de mensagens).
export const FLASH: Record<string, string> = {
  saved: 'Salvo com sucesso.', created: 'Criado com sucesso.', deleted: 'Excluído.', moved: 'Ordem atualizada.',
  hidden: 'Publicação ocultada.', restored: 'Publicação restaurada.', published: 'Publicado.', rechecked: 'Verificação concluída.',
  validation: 'Dados inválidos. Revise os campos.', invalid_url: 'Link inválido ou fora dos domínios permitidos.', folder: 'Link de pasta não serve: cole o link de um arquivo de imagem.',
  duplicate: 'Este item já está cadastrado.', forbidden: 'Sem permissão para esta ação (verificado no banco).', db: 'Não foi possível salvar agora. Tente novamente.',
  drive_unavailable: 'Salvo, mas o Drive não entregou a imagem: o arquivo precisa estar compartilhado como “Qualquer pessoa com o link”. Ela não aparece no site até ficar pública.',
  yt_unavailable: 'Salvo, mas o YouTube indica que o vídeo está privado, removido ou sem incorporação. Ele não aparece no site até ficar disponível.',
  check_unknown: 'Salvo, mas não foi possível verificar a disponibilidade agora (rede). Use “Verificar de novo”.',
  not_found_user: 'Nenhum usuário com este e-mail. Peça para a pessoa ser criada em Authentication → Users no Supabase.',
  no_service: 'Esta ação precisa da SUPABASE_SERVICE_ROLE_KEY configurada no servidor.', bad_login: 'E-mail ou senha incorretos.', config: 'Supabase não configurado no servidor.',
  last_owner: 'Não é possível remover ou rebaixar o último owner.',
};
export const flashText = (code: string | undefined): string | null => (code ? FLASH[code] ?? null : null);
export const isErrorCode = (code: string | undefined) => !!code && ['validation', 'invalid_url', 'folder', 'duplicate', 'forbidden', 'db', 'not_found_user', 'no_service', 'bad_login', 'config', 'last_owner'].includes(code);
export const isWarnCode = (code: string | undefined) => !!code && ['drive_unavailable', 'yt_unavailable', 'check_unknown'].includes(code);
