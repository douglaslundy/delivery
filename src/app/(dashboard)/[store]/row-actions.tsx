"use client";

// Botoes padrao de linha: Editar/Excluir, ou Salvar/Cancelar quando a linha esta em edicao.
export default function RowActions({
  editing,
  busy,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}: {
  editing: boolean;
  busy: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <span className="item-actions">
      {editing ? (
        <>
          <button type="button" disabled={busy} onClick={onSave}>
            {busy ? "Salvando..." : "Salvar"}
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={onEdit}>
            Editar
          </button>
          {onDelete && (
            <button type="button" className="btn-danger" disabled={busy} onClick={onDelete}>
              Excluir
            </button>
          )}
        </>
      )}
    </span>
  );
}
