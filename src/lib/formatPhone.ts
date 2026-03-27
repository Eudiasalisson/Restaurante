/**
 * Formata um número de telefone para exibição no padrão brasileiro.
 * Aceita apenas dígitos ou string já formatada.
 * Exemplo: "11987654321" => "(11) 98765-4321"
 * Exemplo: "1134567890" => "(11) 3456-7890"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d})`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}
