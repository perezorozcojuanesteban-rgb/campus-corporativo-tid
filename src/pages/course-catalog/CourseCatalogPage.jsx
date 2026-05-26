import React from 'react';
import { useLoaderData, useRevalidator, useRouteError, useRouteLoaderData } from 'react-router-dom';
import { CourseCard, EmptyState, ErrorState, FormField, Modal, Spinner } from '../../components/components.jsx';
import { levelBadge } from '../../components/badges.js';
import { COLORS } from '../../components/theme.js';
import { confirm, toast } from '../../helpers/alerts.js';
import { tidApi } from '../../services/tid.js';
import { BookOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

export function CourseCatalogErrorPage() {
  const error = useRouteError();
  return (
    <ErrorState
      title="No se pudo cargar el catalogo"
      message={error?.message || 'Verifica que la API este activa y que VITE_API_URL apunte al backend correcto.'}
      onRetry={() => window.location.reload()}
    />
  );
}

export default function CourseCatalogPage() {
  const revalidator = useRevalidator();
  const { session } = useRouteLoaderData('root');
  const { cursos, categorias, inscripciones } = useLoaderData();
  const isAdmin = session?.rol === 'Admin';
  const isInstructor = session?.rol === 'Instructor';
  const canCreateCurso = isInstructor;

  const [filtroCategoria, setFiltroCategoria] = React.useState(null);
  const [busqueda, setBusqueda] = React.useState('');
  const [filtroNivel, setFiltroNivel] = React.useState(null);
  const [soloDisponibles, setSoloDisponibles] = React.useState(false);
  const [detalleCurso, setDetalleCurso] = React.useState(null);
  const [modalCurso, setModalCurso] = React.useState(null);

  const handleEnroll = async (curso) => {
    if (curso.max > 0 && curso.inscritos >= curso.max) {
      toast.warning('Este curso no tiene cupos disponibles.', 'Cupos agotados');
      return;
    }
    const ok = await confirm({
      title: `Inscribirme en ${curso.titulo}`,
      message: `Duracion: ${curso.duracion} - Nivel: ${curso.nivel}`,
      okText: 'Confirmar inscripcion',
      cancelText: 'Cancelar',
      color: COLORS.accent,
    });
    if (!ok) return;
    try {
      await tidApi.createInscripcion({ usuario_id: session.id, curso_id: curso.id, fecha: new Date().toISOString().split('T')[0] });
      toast.success(`Ahora tienes acceso a "${curso.titulo}"`, 'Inscripcion exitosa');
      revalidator.revalidate();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const [formCurso, setFormCurso] = React.useState({});
  const [savingCurso, setSavingCurso] = React.useState(false);

  const openCreateCurso = () => {
    setFormCurso({
      titulo: '',
      categoria_id: '',
      instructor: isInstructor ? session.nombre : '',
      instructor_id: isInstructor ? session.id : '',
      duracion: '',
      nivel: 'Basico',
      max: 30,
      descripcion: '',
    });
    setModalCurso('create');
  };
  const openEditCurso = (c) => {
    setFormCurso({ ...c });
    setModalCurso('edit');
  };
  const handleSaveCurso = async () => {
    const cuposMaximos = Number(formCurso.max);
    if (!formCurso.titulo?.trim() || !formCurso.categoria_id || !formCurso.instructor?.trim()) {
      toast.warning('Completa titulo, categoria e instructor.', 'Campos requeridos');
      return;
    }
    if (!Number.isFinite(cuposMaximos) || cuposMaximos < 1) {
      toast.warning('Los cupos maximos deben ser mayores a cero.', 'Campos requeridos');
      return;
    }
    setSavingCurso(true);
    try {
      const payload = {
        ...formCurso,
        titulo: formCurso.titulo.trim(),
        instructor: formCurso.instructor.trim(),
        instructor_id: isInstructor ? session.id : formCurso.instructor_id || '',
        descripcion: formCurso.descripcion?.trim() || '',
        categoria_id: Number(formCurso.categoria_id),
        max: cuposMaximos,
      };
      if (modalCurso === 'create') await tidApi.createCurso(payload);
      else await tidApi.updateCurso(formCurso.id, payload);
      setModalCurso(null);
      toast.success(modalCurso === 'create' ? 'Curso creado' : 'Curso actualizado');
      revalidator.revalidate();
    } catch (e) {
      toast.error(e.message || 'No se pudo guardar el curso.');
    } finally {
      setSavingCurso(false);
    }
  };
  const handleDeleteCurso = async (c) => {
    const ok = await confirm({
      title: `Eliminar "${c.titulo}"?`,
      message: 'Esta accion no se puede deshacer.',
      okText: 'Eliminar',
      cancelText: 'Cancelar',
      color: COLORS.danger,
    });
    if (!ok) return;
    try {
      await tidApi.deleteCurso(c.id);
      toast.success('Curso eliminado');
      revalidator.revalidate();
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar el curso.');
    }
  };

  const cursosFiltrados = cursos.filter((c) => {
    if (filtroCategoria && c.categoria_id !== filtroCategoria) return false;
    if (filtroNivel && c.nivel !== filtroNivel) return false;
    if (soloDisponibles && c.max > 0 && c.inscritos >= c.max) return false;
    if (busqueda && !c.titulo.toLowerCase().includes(busqueda.toLowerCase()) && !c.descripcion.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });
const totalCupos = cursos.reduce((total, curso) => total + curso.max, 0);
const totalInscritos = cursos.reduce((total, curso) => total + curso.inscritos, 0);
const cursosConCupos = cursos.filter((curso) => curso.max > curso.inscritos).length;

  const isInscrito = (cursoId) => inscripciones.some((i) => i.curso_id === cursoId);
  const canManageCurso = (curso) => {
    if (isAdmin) return true;
    if (!isInstructor) return false;
    return curso.instructor_id === session.id || curso.instructor === session.nombre;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div className="page-header" style={{ margin: 0 }}>
          <h2>Catalogo de Cursos</h2>
          <p>
            {cursos.length} cursos disponibles - {inscripciones.length} inscripciones activas
          </p>
        </div>
        {canCreateCurso && (
          <button className="btn btn-primary" onClick={openCreateCurso}>
            <Plus size={16} /> Nuevo curso
          </button>   
        )}
        <div className="grid-3" style={{ marginBottom: 24 }}>
  <div className="stat-card">
    <span className="stat-label">Cursos con cupos</span>
    <span className="stat-value">{cursosConCupos}</span>
  </div>
  <div className="stat-card">
    <span className="stat-label">Cupos totales</span>
    <span className="stat-value">{totalCupos}</span>
  </div>
  <div className="stat-card">
    <span className="stat-label">Inscritos</span>
    <span className="stat-value">{totalInscritos}</span>
  </div>
</div>
      </div>

      {revalidator.state !== 'idle' && <Spinner text="Actualizando..." />}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
        <div className="search-box" style={{ flex: '1 1 240px', minWidth: 200 }}>
          <Search size={16} color={COLORS.textMuted} />
          <input placeholder="Buscar cursos..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          {busqueda && (
            <button style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 16 }} onClick={() => setBusqueda('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`tag ${!filtroCategoria ? 'tag-active' : 'tag-inactive'}`} onClick={() => setFiltroCategoria(null)}>
            Todas ({cursos.length})
          </span>
          {categorias.map((cat) => {
            const count = cursos.filter((c) => c.categoria_id === cat.id).length;
            return (
              <span key={cat.id} className={`tag ${filtroCategoria === cat.id ? 'tag-active' : 'tag-inactive'}`} onClick={() => setFiltroCategoria(filtroCategoria === cat.id ? null : cat.id)}>
                {cat.nombre} ({count})
              </span>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Basico', 'Intermedio', 'Avanzado'].map((n) => (
            <span key={n} className={`tag ${filtroNivel === n ? 'tag-active' : 'tag-inactive'}`} onClick={() => setFiltroNivel(filtroNivel === n ? null : n)} style={{ fontSize: 11 }}>
              {n}
            </span>
          ))}
          <span
            className={`tag ${soloDisponibles ? 'tag-active' : 'tag-inactive'}`}
            onClick={() => setSoloDisponibles((value) => !value)}
            style={{ fontSize: 11 }}
          >
            Con cupos
          </span>
        </div>
      </div>

      {cursosFiltrados.length === 0 ? (
        <EmptyState icon={<BookOpen size={44} color={COLORS.textMuted} />} title="No se encontraron cursos" subtitle="Prueba con otros filtros o terminos de busqueda" />
      ) : (
        <div className="grid-3">
          {cursosFiltrados.map((c) => (
            <div key={c.id} style={{ position: 'relative' }}>
              <CourseCard curso={c} categorias={categorias} inscrito={isInscrito(c.id)} onEnroll={handleEnroll} onDetail={setDetalleCurso} />
              {canManageCurso(c) && (
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openEditCurso(c)}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleDeleteCurso(c)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!detalleCurso}
        onClose={() => setDetalleCurso(null)}
        title={detalleCurso?.titulo}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDetalleCurso(null)}>
              Cerrar
            </button>
            {!isInscrito(detalleCurso?.id) && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  handleEnroll(detalleCurso);
                  setDetalleCurso(null);
                }}
              >
                Inscribirme
              </button>
            )}
          </>
        }
      >
        {detalleCurso &&
          (() => {
            const cat = categorias.find((c) => c.id === detalleCurso.categoria_id);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span className={`badge ${levelBadge(detalleCurso.nivel)}`}>{detalleCurso.nivel}</span>
                  {cat && (
                    <span className="badge badge-gray">
                      {cat.nombre}
                    </span>
                  )}
                  {isInscrito(detalleCurso.id) && <span className="badge badge-green">Ya inscrito</span>}
                </div>
                <p style={{ color: COLORS.textSecondary, fontSize: 14, lineHeight: 1.7 }}>{detalleCurso.descripcion}</p>
                <div className="grid-2" style={{ gap: 12 }}>
                  {[
                    ['Instructor', detalleCurso.instructor],
                    ['Duracion', detalleCurso.duracion],
                    ['Cupos', `${detalleCurso.inscritos}/${detalleCurso.max}`],
                  ].map(([l, v]) => (
                    <div key={l} style={{ background: COLORS.surface2, borderRadius: 8, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{l}</div>
                      <div style={{ fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
      </Modal>

      <Modal
        open={!!modalCurso}
        onClose={() => setModalCurso(null)}
        title={modalCurso === 'create' ? 'Nuevo curso' : 'Editar curso'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModalCurso(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveCurso} disabled={savingCurso}>
              {savingCurso ? (
                <>
                  <div className="spinner" style={{ width: 14, height: 14 }}></div> Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="Titulo">
            <input className="form-input" value={formCurso.titulo || ''} onChange={(e) => setFormCurso((p) => ({ ...p, titulo: e.target.value }))} placeholder="Nombre del curso" />
          </FormField>
          <div className="grid-2">
            <FormField label="Categoria">
              <select className="form-input" value={formCurso.categoria_id || ''} onChange={(e) => setFormCurso((p) => ({ ...p, categoria_id: e.target.value }))}>
                <option value="">Seleccionar...</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Nivel">
              <select className="form-input" value={formCurso.nivel || 'Basico'} onChange={(e) => setFormCurso((p) => ({ ...p, nivel: e.target.value }))}>
                {['Basico', 'Intermedio', 'Avanzado'].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="grid-2">
            <FormField label="Instructor">
              <input
                className="form-input"
                value={formCurso.instructor || ''}
                onChange={(e) => setFormCurso((p) => ({ ...p, instructor: e.target.value }))}
                placeholder="Nombre del instructor"
                disabled={isInstructor}
              />
            </FormField>
            <FormField label="Duracion">
              <input className="form-input" value={formCurso.duracion || ''} onChange={(e) => setFormCurso((p) => ({ ...p, duracion: e.target.value }))} placeholder="Ej: 40h" />
            </FormField>
          </div>
          <FormField label="Cupos maximos">
            <input type="number" className="form-input" value={formCurso.max || ''} onChange={(e) => setFormCurso((p) => ({ ...p, max: e.target.value }))} />
          </FormField>
          <FormField label="Descripcion">
            <textarea className="form-input" rows={3} value={formCurso.descripcion || ''} onChange={(e) => setFormCurso((p) => ({ ...p, descripcion: e.target.value }))} placeholder="Descripcion del curso..." style={{ resize: 'vertical' }} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
