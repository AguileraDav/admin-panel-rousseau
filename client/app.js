document.addEventListener('DOMContentLoaded', () => {
  const AUTH_BACKEND_URL = 'https://admin-panel-rousseau.onrender.com';
  const loginScreen = document.getElementById('loginScreen');
  const dashboardRoot = document.getElementById('dashboardRoot');
  const loginForm = document.getElementById('loginForm');
  const loginFeedback = document.getElementById('loginFeedback');
  const togglePassword = document.getElementById('togglePassword');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const loginSpinner = document.getElementById('loginSpinner');
  const loginSubmitLabel = document.getElementById('loginSubmitLabel');
  const logoutBtn = document.getElementById('logoutBtn');
  const userRoleLabel = document.getElementById('userRoleLabel');
  const userAvatar = document.getElementById('userAvatar');

  const ROLE_LABELS = { admin: 'Administrador', profesor: 'Profesor' };

  function getSession() {
    const token = localStorage.getItem('authToken');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
      return { token, email: payload.email, role: payload.role };
    } catch (err) {
      return null;
    }
  }

  function showDashboard(session) {
    loginScreen.classList.add('hidden');
    dashboardRoot.classList.remove('hidden');
    const label = ROLE_LABELS[session.role] || session.role;
    userRoleLabel.textContent = label;
    userAvatar.textContent = label.charAt(0).toUpperCase();
  }

  function showLogin() {
    dashboardRoot.classList.add('hidden');
    loginScreen.classList.remove('hidden');
  }

  function logout() {
    localStorage.removeItem('authToken');
    showLogin();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      loginFeedback.textContent = '';
      loginFeedback.className = 'form-feedback';
      loginSubmitBtn.disabled = true;
      loginSpinner.hidden = false;
      loginSubmitLabel.textContent = 'Iniciando sesión...';

      try {
        const res = await fetch(`${AUTH_BACKEND_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

        localStorage.setItem('authToken', data.token);
        showDashboard({ role: data.role, email: data.email });
        loginForm.reset();
      } catch (err) {
        loginFeedback.textContent = err.message || 'No se pudo iniciar sesión.';
        loginFeedback.classList.add('error');
      } finally {
        loginSubmitBtn.disabled = false;
        loginSpinner.hidden = true;
        loginSubmitLabel.textContent = 'Iniciar sesión';
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  if (togglePassword && loginPasswordInput) {
    togglePassword.addEventListener('click', () => {
      const isHidden = loginPasswordInput.type === 'password';
      loginPasswordInput.type = isHidden ? 'text' : 'password';
      togglePassword.setAttribute('aria-label', isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  }

  const initialSession = getSession();
  if (initialSession) {
    showDashboard(initialSession);
  } else {
    showLogin();
  }

  const sidebarNav = document.querySelector('.sidebar-nav');
  const items = sidebarNav.querySelectorAll('.nav-item');
  const adminContent = document.getElementById('adminContent');

  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    sidebarOverlay.classList.remove('visible');
  }

  if (mobileMenuBtn && sidebar && sidebarOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.add('mobile-open');
      sidebarOverlay.classList.add('visible');
    });
    sidebarOverlay.addEventListener('click', closeMobileSidebar);
  }

  // Guardar contenido original de inicio para restaurar
  const inicioHTML = adminContent.innerHTML;

  // Estado del menú semanal de alimentos (persiste mientras no se recargue la página)
  const WEEK_DAYS = [
    { id: 'lunes', label: 'Lunes' },
    { id: 'martes', label: 'Martes' },
    { id: 'miercoles', label: 'Miércoles' },
    { id: 'jueves', label: 'Jueves' },
    { id: 'viernes', label: 'Viernes' }
  ];
  const foodMenus = {}; // { lunes: { meal, dessert, drink }, ... }
  let editingDay = null; // día actualmente en edición, o null

  // Estado de calificaciones por materia (calificación mediante estrella de color)
  const DEFAULT_SUBJECTS = [
    'Lenguaje y comunicación',
    'Pensamiento matemático',
    'Desarrollo personal y social',
    'Exploración y conocimiento del medio',
    'Desarrollo físico y salud',
    'Expresión y apreciación artística',
    'Inglés',
    'Computación',
    'Tareas y participación',
    'Materiales'
  ];
  // Bimestres: cada materia tiene una calificación (estrella) independiente por bimestre.
  // Esquema real en Firestore: doc.bimestres = { b1: { <materia>: 'verde'|'amarillo'|'rojo', inasistencias: number }, ..., b5: {...} }
  const BIMESTRES = ['b1', 'b2', 'b3', 'b4', 'b5'];
  const gradeSubjects = DEFAULT_SUBJECTS.map((name, i) => ({
    id: `subj-${i}`,
    name,
    ratings: Object.fromEntries(BIMESTRES.map(b => [b, null]))
  }));
  const gradeInasistencias = Object.fromEntries(BIMESTRES.map(b => [b, 0]));
  const RATING_CYCLE = [null, 'verde', 'amarillo', 'rojo'];
  const RATING_LABELS = { verde: 'Destacado', amarillo: 'En proceso', rojo: 'Se le dificulta' };
  const RATING_CLASS = { verde: 'green', amarillo: 'yellow', rojo: 'red' };
  let gradeStudents = []; // alumnos cargados desde la colección "grades"
  let selectedStudentId = null;

  function buildGradesHTML(){
    const rowsHTML = gradeSubjects.map(s => {
      const starsHTML = BIMESTRES.map(b => {
        const rating = s.ratings[b];
        const starClass = rating ? `star-${RATING_CLASS[rating]}` : 'star-empty';
        const label = rating ? RATING_LABELS[rating] : 'Sin calificar';
        return `<button type="button" class="star-btn ${starClass}" data-toggle-rating="${s.id}" data-bimestre="${b}" title="${b.toUpperCase()}: ${label}">★</button>`;
      }).join('');
      return `
        <tr>
          <td>${s.name}</td>
          <td class="grade-star-cell">${starsHTML}</td>
        </tr>
      `;
    }).join('');

    const inasistenciasHTML = BIMESTRES.map(b => `
      <input type="number" min="0" class="grade-inasistencias-input" data-inasistencias-bimestre="${b}" value="${gradeInasistencias[b]}" ${selectedStudentId ? '' : 'disabled'} />
    `).join('');

    const studentOptionsHTML = gradeStudents.map(st =>
      `<option value="${st.id}" ${st.id === selectedStudentId ? 'selected' : ''}>${st.childName || '(sin nombre)'}</option>`
    ).join('');

    return `
      <div class="calendar-section">
        <div class="form-row">
          <label for="gradeStudentSelect">Alumno</label>
          <select id="gradeStudentSelect">
            <option value="">Selecciona un alumno...</option>
            ${studentOptionsHTML}
          </select>
        </div>

        <table class="grades-table">
          <thead>
            <tr><th>Materia</th><th class="grade-star-cell">${BIMESTRES.map(b => `<span class="grade-bimestre-label">${b.toUpperCase()}</span>`).join('')}</th></tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
          <tfoot>
            <tr>
              <td>Inasistencias</td>
              <td class="grade-star-cell">${inasistenciasHTML}</td>
            </tr>
          </tfoot>
        </table>

        <div class="grades-legend">
          <span><span class="star-btn star-green">★</span> Destacado</span>
          <span><span class="star-btn star-yellow">★</span> En proceso</span>
          <span><span class="star-btn star-red">★</span> Se le dificulta</span>
        </div>

        <div class="form-actions">
          <button type="button" id="uploadGradesBtn" class="btn-primary" ${selectedStudentId ? '' : 'disabled'}>Subir calificaciones</button>
        </div>
        <div id="gradesUploadFeedback" class="form-feedback" aria-live="polite"></div>
      </div>
    `;
  }

  // Estado del calendario académico (periodos escolares, fin de ciclo, etc.)
  const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const WEEKDAY_LABELS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const calendarPeriods = []; // { id, title, color, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
  let calendarViewDate = new Date(); // mes actualmente visible en el calendario

  function toDateOnly(str){
    // Evita desfases de zona horaria al comparar fechas 'YYYY-MM-DD'
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function buildCalendarHTML(){
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // Lunes = 0 ... Domingo = 6
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for(let i = 0; i < firstWeekday; i++) cells.push(null);
    for(let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while(cells.length % 7 !== 0) cells.push(null);

    const daysHTML = cells.map(date => {
      if(!date){
        return `<div class="cal-day cal-day-empty"></div>`;
      }
      const dayPeriods = calendarPeriods.filter(p => date >= toDateOnly(p.start) && date <= toDateOnly(p.end));
      const barsHTML = dayPeriods.slice(0, 3).map(p =>
        `<span class="cal-day-bar" style="background:${p.color}" title="${p.title}"></span>`
      ).join('');
      const isToday = date.toDateString() === new Date().toDateString();
      return `
        <div class="cal-day ${isToday ? 'cal-day-today' : ''}">
          <span class="cal-day-num">${date.getDate()}</span>
          <div class="cal-day-bars">${barsHTML}</div>
        </div>
      `;
    }).join('');

    const legendHTML = calendarPeriods.length === 0
      ? `<p class="cal-legend-empty">Aún no hay periodos escolares agregados.</p>`
      : calendarPeriods.map(p => `
          <li class="cal-legend-item">
            <span class="cal-legend-color" style="background:${p.color}"></span>
            <span class="cal-legend-title">${p.title}</span>
            <span class="cal-legend-dates">${p.start} → ${p.end}</span>
            <button type="button" class="cal-legend-delete" data-delete-period="${p.id}" aria-label="Eliminar periodo">✕</button>
          </li>
        `).join('');

    return `
      <div class="calendar-section">
        <div class="cal-header">
          <button type="button" id="calPrevMonth" class="btn-secondary">←</button>
          <h3>${MONTH_NAMES[month]} ${year}</h3>
          <button type="button" id="calNextMonth" class="btn-secondary">→</button>
        </div>
        <div class="cal-grid cal-grid-labels">
          ${WEEKDAY_LABELS.map(l => `<div class="cal-weekday">${l}</div>`).join('')}
        </div>
        <div class="cal-grid">${daysHTML}</div>

        <ul class="cal-legend">${legendHTML}</ul>

        <h3 class="cal-form-title">Agregar periodo escolar</h3>
        <form id="periodForm" class="event-form">
          <div class="form-row">
            <label for="periodTitle">Título</label>
            <input type="text" id="periodTitle" name="title" placeholder="Ej. Primer ciclo, Vacaciones de verano" required />
          </div>
          <div class="form-row">
            <label for="periodColor">Color</label>
            <input type="color" id="periodColor" name="color" value="#A855F7" />
          </div>
          <div class="form-row">
            <label for="periodStart">Fecha de inicio</label>
            <input type="date" id="periodStart" name="start" required />
          </div>
          <div class="form-row">
            <label for="periodEnd">Fecha de fin</label>
            <input type="date" id="periodEnd" name="end" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Agregar al calendario</button>
          </div>
          <div id="periodFeedback" class="form-feedback" aria-live="polite"></div>
        </form>
      </div>
    `;
  }

  // Estado de asistencia por alumno (verdadero/falso por día del mes)
  let attendanceStudents = []; // reutiliza la lista de alumnos de la colección "grades"
  let attendanceStudentId = null;
  let attendanceViewDate = new Date(); // mes actualmente visible
  let attendanceDays = {}; // { 'YYYY-MM-DD': true/false }

  function dateKey(date){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function buildAttendanceHTML(){
    const year = attendanceViewDate.getFullYear();
    const month = attendanceViewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for(let i = 0; i < firstWeekday; i++) cells.push(null);
    for(let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while(cells.length % 7 !== 0) cells.push(null);

    const daysHTML = cells.map(date => {
      if(!date) return `<div class="cal-day cal-day-empty"></div>`;
      const key = dateKey(date);
      const value = attendanceDays[key];
      const stateClass = value === true ? 'att-day-present' : value === false ? 'att-day-absent' : '';
      const isToday = date.toDateString() === new Date().toDateString();
      return `
        <button type="button" class="cal-day att-day ${stateClass} ${isToday ? 'cal-day-today' : ''}" data-att-day="${key}" ${attendanceStudentId ? '' : 'disabled'}>
          <span class="cal-day-num">${date.getDate()}</span>
        </button>
      `;
    }).join('');

    const studentOptionsHTML = attendanceStudents.map(st =>
      `<option value="${st.id}" ${st.id === attendanceStudentId ? 'selected' : ''}>${st.childName || '(sin nombre)'}</option>`
    ).join('');

    return `
      <div class="calendar-section">
        <div class="form-row">
          <label for="attStudentSelect">Alumno</label>
          <select id="attStudentSelect">
            <option value="">Selecciona un alumno...</option>
            ${studentOptionsHTML}
          </select>
        </div>

        <div class="cal-header">
          <button type="button" id="attPrevMonth" class="btn-secondary">←</button>
          <h3>${MONTH_NAMES[month]} ${year}</h3>
          <button type="button" id="attNextMonth" class="btn-secondary">→</button>
        </div>
        <div class="cal-grid cal-grid-labels">
          ${WEEKDAY_LABELS.map(l => `<div class="cal-weekday">${l}</div>`).join('')}
        </div>
        <div class="cal-grid">${daysHTML}</div>

        <p class="att-hint">Haz clic en un día para marcarlo: verde (asistió), rojo (faltó). Da click de nuevo para quitar la marca.</p>

        <div class="form-actions">
          <button type="button" id="uploadAttendanceBtn" class="btn-primary" ${attendanceStudentId ? '' : 'disabled'}>Guardar asistencia</button>
        </div>
        <div id="attendanceUploadFeedback" class="form-feedback" aria-live="polite"></div>
      </div>
    `;
  }

  function setActive(el){
    items.forEach(i => i.classList.remove('active'));
    el.classList.add('active');
  }

  function renderSection(action){
    // Si la acción es "inicio", restauramos el html completo del dashboard original
    if(action === 'inicio') {
      adminContent.innerHTML = inicioHTML;
      return;
    }

    let html = '';
    switch(action){
      case 'chat':
        html = `<h2>Chat Moderado</h2><p>Panel de mensajería para maestros y administradores.</p>`;
        break;
      case 'eventos':
        html = `
          <h2>Agenda de Eventos</h2>
          <p>Crear nuevo evento en el calendario.</p>
          <div class="calendar-section">
            <form id="eventForm" class="event-form">
              <div class="form-row">
                <label for="eventDate">Fecha</label>
                <input type="date" id="eventDate" name="date" required />
              </div>
              <div class="form-row">
                <label for="eventName">Nombre del evento</label>
                <input type="text" id="eventName" name="name" placeholder="Ej. Reunión de padres" required />
              </div>
              <div class="form-row">
                <label for="eventDesc">Descripción</label>
                <textarea id="eventDesc" name="description" rows="4" placeholder="Descripción del evento..."></textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Crear evento</button>
                <button type="button" id="eventCancel" class="btn-secondary">Cancelar</button>
              </div>
              <div id="eventFeedback" class="form-feedback" aria-live="polite"></div>
            </form>
          </div>
        `;
        break;
      case 'calendario':
        html = `
          <h2>Calendario Académico</h2>
          <p>Agrega periodos escolares, fin de ciclo y otras fechas importantes con título y color.</p>
          ${buildCalendarHTML()}
        `;
        break;
      case 'pagos':
        html = `
          <h2>Registro de Pagos</h2>
          <p>Pagos confirmados a través de Mercado Pago.</p>
          <div id="paymentsList" class="payments-list">
            <p class="payments-loading">Cargando pagos...</p>
          </div>
        `;
        break;
      case 'asistencias':
        html = `
          <h2>Control de Asistencias</h2>
          <p>Selecciona un alumno y marca su asistencia día por día.</p>
          ${buildAttendanceHTML()}
        `;
        break;
      case 'solicitudes':
        html = `
          <h2>Solicitudes</h2>
          <p>Mensajes enviados por los padres de familia.</p>
          <div id="solicitudesList" class="payments-list">
            <p class="payments-loading">Cargando solicitudes...</p>
          </div>
        `;
        break;
      case 'calificaciones':
        html = `
          <h2>Calificaciones por Materia</h2>
          <p>Haz clic en la estrella para calificar: verde (destacado), amarillo (en proceso), rojo (se le dificulta). Para cambiar la estrella de color da click nuevamente.</p>
          ${buildGradesHTML()}
        `;
        break;
      case 'alimentos': {
        // Si el día que se estaba editando ya no existe (caso raro), limpiamos el estado
        if(editingDay && !WEEK_DAYS.some(d => d.id === editingDay)) editingDay = null;

        const pendingDay = WEEK_DAYS.find(d => !foodMenus[d.id]);
        const allDone = !pendingDay;
        const targetDay = editingDay || (pendingDay ? pendingDay.id : null);
        const existingMenu = editingDay ? foodMenus[editingDay] : null;

        const daysListHTML = WEEK_DAYS.map(d => {
          const saved = !!foodMenus[d.id];
          return `
            <li class="food-day-item ${saved ? 'saved' : ''}">
              <span class="food-day-status">${saved ? '✓' : '○'}</span>
              <span class="food-day-label">${d.label}</span>
              <span class="food-day-state">${saved ? 'Guardado' : 'Pendiente'}</span>
              ${saved ? `<button type="button" class="food-day-edit" data-edit-day="${d.id}">Editar</button>` : ''}
            </li>
          `;
        }).join('');

        const dayOptionsHTML = WEEK_DAYS.map(d => {
          const saved = !!foodMenus[d.id];
          // En modo edición solo se puede elegir el día que se está editando
          const disabled = editingDay ? d.id !== editingDay : saved;
          const selected = targetDay && d.id === targetDay ? 'selected' : '';
          return `<option value="${d.id}" ${disabled ? 'disabled' : ''} ${selected}>${d.label}${saved && !editingDay ? ' (ya guardado)' : ''}</option>`;
        }).join('');

        const noFormMessage = `<p class="form-feedback success">Ya se guardó el menú de los 5 días de la semana. Usa "Editar" en la lista para modificar un día.</p>`;

        const formHTML = (!targetDay)
          ? noFormMessage
          : `
            <form id="foodForm" class="event-form">
              <div class="form-row">
                <label for="foodDay">Día de la semana</label>
                <select id="foodDay" name="day" required>
                  <option value="" disabled>Selecciona un día</option>
                  ${dayOptionsHTML}
                </select>
              </div>
              <div class="form-row">
                <label for="foodMeal">Comida</label>
                <textarea id="foodMeal" name="meal" rows="3" placeholder="Ej. Arroz con pollo y ensalada" required>${existingMenu ? existingMenu.meal : ''}</textarea>
              </div>
              <div class="form-row">
                <label for="foodDessert">Postre</label>
                <textarea id="foodDessert" name="dessert" rows="2" placeholder="Ej. Gelatina de frutas">${existingMenu ? existingMenu.dessert : ''}</textarea>
              </div>
              <div class="form-row">
                <label for="foodDrink">Agua</label>
                <textarea id="foodDrink" name="drink" rows="2" placeholder="Ej. Agua de horchata">${existingMenu ? existingMenu.drink : ''}</textarea>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">${editingDay ? 'Actualizar menú del día' : 'Guardar menú del día'}</button>
                <button type="button" id="foodCancel" class="btn-secondary">${editingDay ? 'Cancelar edición' : 'Cancelar'}</button>
              </div>
              <div id="foodFeedback" class="form-feedback" aria-live="polite"></div>
            </form>
          `;

        const hasAnyDay = Object.keys(foodMenus).length > 0;
        const sendMenuHTML = hasAnyDay ? `
          <div class="food-send-section">
            <button type="button" id="foodSendMenu" class="btn-primary">Enviar menú</button>
            <p class="food-send-hint">Envía el menú semanal completo (${Object.keys(foodMenus).length}/${WEEK_DAYS.length} días) a la base de datos.</p>
            <div id="foodSendFeedback" class="form-feedback" aria-live="polite"></div>
          </div>
        ` : '';

        html = `
          <h2>Menú de Alimentos</h2>
          <p>Define el menú del comedor día por día. Al guardar un día, se habilita el siguiente hasta completar la semana.</p>
          <div class="calendar-section">
            <ul class="food-days-list">${daysListHTML}</ul>
            ${formHTML}
            ${sendMenuHTML}
          </div>
        `;
        break;
      }
      case 'inscripciones':
        html = `
          <h2>Inscripciones</h2>
          <p>Registra una nueva inscripción de alumno.</p>
          <div class="calendar-section">
            <form id="enrollmentForm" class="event-form">
              <div class="form-row">
                <label for="enrollStudentName">Nombre del alumno</label>
                <input type="text" id="enrollStudentName" name="studentName" placeholder="Ej. Melany Mitchell Rivero Gonzalez" required />
              </div>
              <div class="form-row">
                <label for="enrollStudentCode">Código del alumno</label>
                <input type="text" id="enrollStudentCode" name="studentCode" placeholder="Ej. ROUSS-2026-001" required />
              </div>
              <div class="form-row">
                <label for="enrollParentName">Nombre del padre/madre/tutor</label>
                <input type="text" id="enrollParentName" name="parentName" placeholder="Ej. Valeria Duarte Rosas" required />
              </div>
              <div class="form-row">
                <label for="enrollParentEmail">Correo del padre/madre/tutor</label>
                <input type="email" id="enrollParentEmail" name="parentEmail" placeholder="correo@ejemplo.com" required />
              </div>
              <div class="form-row">
                <label for="enrollParentPhone">Teléfono del padre/madre/tutor</label>
                <input type="tel" id="enrollParentPhone" name="parentPhone" placeholder="Ej. 5577215954" required />
              </div>
              <div class="form-row">
                <label for="enrollParentId">ID del padre/madre/tutor (opcional)</label>
                <input type="text" id="enrollParentId" name="parentId" placeholder="ID de cuenta del padre" />
              </div>
              <div class="form-row">
                <label for="enrollStatus">Estado</label>
                <select id="enrollStatus" name="status">
                  <option value="approved">Aprobada</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="rejected">Rechazada</option>
                </select>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Guardar inscripción</button>
                <button type="button" id="enrollCancel" class="btn-secondary">Cancelar</button>
              </div>
              <div id="enrollFeedback" class="form-feedback" aria-live="polite"></div>
            </form>
          </div>
          <div id="enrollmentsList" class="payments-list">
            <p class="payments-loading">Cargando inscripciones...</p>
          </div>
        `;
        break;
      case 'perfil':
        html = `<h2>Configuración de Perfil</h2><p>Ajusta las credenciales de tu cuenta de administrador.</p>`;
        break;
      default:
        html = `<h2>Sección: ${action}</h2><p>Contenido en desarrollo...</p>`;
    }
    
    // Envolvemos en un contenedor estándar para que no se pegue crudo
    adminContent.innerHTML = `<section class="generic-section" style="background:white; padding: 40px; border-radius: var(--radius); box-shadow: 0 4px 15px rgba(0,0,0,0.02)">${html}</section>`;

    // Si renderizamos la sección pagos, cargamos los pagos confirmados desde la base de datos
    if(action === 'pagos'){
      const listEl = document.getElementById('paymentsList');
      (async () => {
        try {
          const res = await fetch(`${AUTH_BACKEND_URL}/api/payments`);
          if(!res.ok) throw new Error('Error en el servidor');
          const data = await res.json();
          const payments = data.payments || [];

          if(payments.length === 0){
            listEl.innerHTML = `<p class="payments-empty">Aún no hay pagos registrados.</p>`;
            return;
          }

          const formatAmount = (amount, currency) => {
            if(typeof amount !== 'number') return '—';
            try {
              return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency || 'MXN' }).format(amount);
            } catch {
              return `$${amount}`;
            }
          };
          // Los pagos ya confirmados por el webhook traen "paidAt" (timestamp de Firestore);
          // los que la app crea como pendientes traen "createdAt" (número en milisegundos).
          const formatDate = (p) => {
            if(p.paidAt && p.paidAt._seconds) return new Date(p.paidAt._seconds * 1000).toLocaleString('es-MX');
            if(typeof p.createdAt === 'number') return new Date(p.createdAt).toLocaleString('es-MX');
            return '—';
          };

          const rowsHTML = payments.map(p => `
            <tr>
              <td>${p.concept || p.description || 'Pago'}</td>
              <td>${p.type || '—'}</td>
              <td>${p.payerEmail || p.parentId || p.userId || '—'}</td>
              <td>${formatAmount(p.amount, p.currency)}</td>
              <td>${formatDate(p)}</td>
              <td><span class="payment-status payment-status-${p.status || 'pendiente'}">${p.status || 'pendiente'}</span></td>
            </tr>
          `).join('');

          listEl.innerHTML = `
            <table class="payments-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Tipo</th>
                  <th>Alumno / Padre</th>
                  <th>Monto</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>${rowsHTML}</tbody>
            </table>
          `;
        } catch (err) {
          console.error(err);
          if(listEl) listEl.innerHTML = `<p class="payments-empty">No se pudieron cargar los pagos.</p>`;
        }
      })();
    }

    // Si renderizamos la sección solicitudes, cargamos los mensajes desde la base de datos
    if(action === 'solicitudes'){
      const listEl = document.getElementById('solicitudesList');
      (async () => {
        try {
          const res = await fetch(`${AUTH_BACKEND_URL}/api/solicitudes`);
          if(!res.ok) throw new Error('Error en el servidor');
          const data = await res.json();
          const solicitudes = data.solicitudes || [];

          if(solicitudes.length === 0){
            listEl.innerHTML = `<p class="payments-empty">Aún no hay solicitudes.</p>`;
            return;
          }

          const formatDate = (s) => {
            if(s.timestamp && s.timestamp._seconds) return new Date(s.timestamp._seconds * 1000).toLocaleString('es-MX');
            if(typeof s.timestamp === 'number') return new Date(s.timestamp).toLocaleString('es-MX');
            return '—';
          };

          listEl.innerHTML = solicitudes.map(s => `
            <div class="request-card">
              <div class="request-card-header">
                <div>
                  <strong>${s.userName || 'Usuario desconocido'}</strong>
                  <span class="request-card-email">${s.userEmail || ''}</span>
                </div>
                <span class="request-card-date">${formatDate(s)}</span>
              </div>
              <div class="request-card-subject">${s.subject || '(sin asunto)'}</div>
              <p class="request-card-message">${s.message || ''}</p>
            </div>
          `).join('');
        } catch (err) {
          console.error(err);
          if(listEl) listEl.innerHTML = `<p class="payments-empty">No se pudieron cargar las solicitudes.</p>`;
        }
      })();
    }

    // Si renderizamos la sección eventos, añadimos listeners para el formulario
    if(action === 'eventos'){
      const form = document.getElementById('eventForm');
      const feedback = document.getElementById('eventFeedback');
      const cancelBtn = document.getElementById('eventCancel');

      if(form){
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if(feedback){ feedback.textContent = ''; feedback.className = 'form-feedback'; }

          const date = document.getElementById('eventDate').value;
          const name = document.getElementById('eventName').value.trim();
          const description = document.getElementById('eventDesc').value.trim();

          if(!date || !name){
            if(feedback){ feedback.textContent = 'Por favor completa la fecha y el nombre del evento.'; feedback.classList.add('error'); }
            return;
          }

          const payload = { date, name, description };

          try {
            // Nota: endpoint temporal '/api/events' — en el siguiente paso se conectará a la base de datos
            // Usar URL absoluta hacia el backend Express (puerto 3000)
            // Esto evita que el fetch apunte al servidor de desarrollo del Live Server (ej: :5500)
            const BACKEND_URL = 'https://admin-panel-rousseau.onrender.com';
            const res = await fetch(`${BACKEND_URL}/api/events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if(!res.ok) throw new Error('Error en el servidor');

            if(feedback){ feedback.textContent = 'Evento creado correctamente (guardado en la base de datos).'; feedback.classList.add('success'); }
            form.reset();
          } catch (err) {
            console.error(err);
            if(feedback){ feedback.textContent = 'No se pudo crear el evento. (Endpoint no disponible)'; feedback.classList.add('error'); }
          }
        });
      }

      if(cancelBtn){
        cancelBtn.addEventListener('click', () => {
          renderSection('inicio');
          items.forEach(i => i.classList.remove('active'));
          const inicioBtn = document.querySelector('.nav-item[data-action="inicio"]');
          if(inicioBtn) inicioBtn.classList.add('active');
        });
      }
    }

    // Si renderizamos la sección inscripciones, cargamos la lista y añadimos listeners para el formulario
    if(action === 'inscripciones'){
      const AUTH_BACKEND_URL_LOCAL = 'https://admin-panel-rousseau.onrender.com';
      const listEl = document.getElementById('enrollmentsList');

      const formatDate = (i) => {
        if(i.createdAt && i.createdAt._seconds) return new Date(i.createdAt._seconds * 1000).toLocaleString('es-MX');
        return '—';
      };

      const loadEnrollments = async () => {
        if(!listEl) return;
        try {
          const res = await fetch(`${AUTH_BACKEND_URL_LOCAL}/api/inscripciones`);
          if(!res.ok) throw new Error('Error en el servidor');
          const data = await res.json();
          const inscripciones = data.inscripciones || [];

          if(inscripciones.length === 0){
            listEl.innerHTML = `<p class="payments-empty">Aún no hay inscripciones registradas.</p>`;
            return;
          }

          const rowsHTML = inscripciones.map(i => `
            <tr>
              <td>${i.studentName || '—'}</td>
              <td>${i.studentCode || '—'}</td>
              <td>${i.parentName || '—'}</td>
              <td>${i.parentEmail || '—'}</td>
              <td>${i.parentPhone || '—'}</td>
              <td>${formatDate(i)}</td>
              <td><span class="payment-status payment-status-${i.status || 'pendiente'}">${i.status || 'pendiente'}</span></td>
            </tr>
          `).join('');

          listEl.innerHTML = `
            <table class="payments-table">
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Código</th>
                  <th>Padre/Madre/Tutor</th>
                  <th>Correo</th>
                  <th>Teléfono</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>${rowsHTML}</tbody>
            </table>
          `;
        } catch (err) {
          console.error(err);
          listEl.innerHTML = `<p class="payments-empty">No se pudieron cargar las inscripciones.</p>`;
        }
      };

      loadEnrollments();

      const form = document.getElementById('enrollmentForm');
      const feedback = document.getElementById('enrollFeedback');
      const cancelBtn = document.getElementById('enrollCancel');

      if(form){
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if(feedback){ feedback.textContent = ''; feedback.className = 'form-feedback'; }

          const studentName = document.getElementById('enrollStudentName').value.trim();
          const studentCode = document.getElementById('enrollStudentCode').value.trim();
          const parentName = document.getElementById('enrollParentName').value.trim();
          const parentEmail = document.getElementById('enrollParentEmail').value.trim();
          const parentPhone = document.getElementById('enrollParentPhone').value.trim();
          const parentId = document.getElementById('enrollParentId').value.trim();
          const status = document.getElementById('enrollStatus').value;

          if(!studentName || !studentCode || !parentName || !parentEmail || !parentPhone){
            if(feedback){ feedback.textContent = 'Por favor completa todos los campos obligatorios.'; feedback.classList.add('error'); }
            return;
          }

          const payload = { studentName, studentCode, parentName, parentEmail, parentPhone, parentId, status };

          try {
            const res = await fetch(`${AUTH_BACKEND_URL_LOCAL}/api/inscripciones`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if(!res.ok) throw new Error('Error en el servidor');

            if(feedback){ feedback.textContent = 'Inscripción guardada correctamente.'; feedback.classList.add('success'); }
            form.reset();
            loadEnrollments();
          } catch (err) {
            console.error(err);
            if(feedback){ feedback.textContent = 'No se pudo guardar la inscripción.'; feedback.classList.add('error'); }
          }
        });
      }

      if(cancelBtn){
        cancelBtn.addEventListener('click', () => {
          renderSection('inicio');
          items.forEach(i => i.classList.remove('active'));
          const inicioBtn = document.querySelector('.nav-item[data-action="inicio"]');
          if(inicioBtn) inicioBtn.classList.add('active');
        });
      }
    }

    // Si renderizamos la sección calificaciones, añadimos listeners para las estrellas y el formulario
    if(action === 'calificaciones'){
      const starBtns = document.querySelectorAll('[data-toggle-rating]');
      const inasistenciasInputs = document.querySelectorAll('[data-inasistencias-bimestre]');
      const studentSelect = document.getElementById('gradeStudentSelect');
      const uploadBtn = document.getElementById('uploadGradesBtn');
      const uploadFeedback = document.getElementById('gradesUploadFeedback');

      starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle-rating');
          const bimestre = btn.getAttribute('data-bimestre');
          const subject = gradeSubjects.find(s => s.id === id);
          if(!subject) return;
          const currentIndex = RATING_CYCLE.indexOf(subject.ratings[bimestre]);
          subject.ratings[bimestre] = RATING_CYCLE[(currentIndex + 1) % RATING_CYCLE.length];
          renderSection('calificaciones');
        });
      });

      inasistenciasInputs.forEach(input => {
        input.addEventListener('change', () => {
          const bimestre = input.getAttribute('data-inasistencias-bimestre');
          gradeInasistencias[bimestre] = Math.max(0, parseInt(input.value, 10) || 0);
        });
      });

      // Cargamos la lista de alumnos (colección "grades") una sola vez
      if(gradeStudents.length === 0){
        (async () => {
          try {
            const res = await fetch(`${AUTH_BACKEND_URL}/api/grades`);
            if(!res.ok) throw new Error('Error en el servidor');
            const data = await res.json();
            gradeStudents = data.students || [];
            renderSection('calificaciones');
          } catch (err) {
            console.error('Error cargando alumnos:', err);
          }
        })();
      }

      if(studentSelect){
        studentSelect.addEventListener('change', () => {
          selectedStudentId = studentSelect.value || null;

          const student = gradeStudents.find(s => s.id === selectedStudentId);
          // "materias" en el documento real es un arreglo de nombres (strings); si no existe, usamos la lista por defecto.
          const materiaNames = student && Array.isArray(student.materias) && student.materias.length > 0
            ? student.materias
            : DEFAULT_SUBJECTS;
          const bimestres = (student && student.bimestres) || {};

          gradeSubjects.length = 0;
          materiaNames.forEach((name, i) => {
            gradeSubjects.push({
              id: `subj-${i}`,
              name,
              ratings: Object.fromEntries(BIMESTRES.map(b => {
                const raw = bimestres[b] ? bimestres[b][name] : null;
                const normalized = raw ? raw.trim().toLowerCase() : null;
                return [b, RATING_CYCLE.includes(normalized) ? normalized : null];
              }))
            });
          });

          BIMESTRES.forEach(b => {
            gradeInasistencias[b] = (bimestres[b] && Number(bimestres[b].inasistencias)) || 0;
          });

          renderSection('calificaciones');
        });
      }

      if(uploadBtn){
        uploadBtn.addEventListener('click', async () => {
          if(!selectedStudentId) return;
          if(uploadFeedback){ uploadFeedback.textContent = ''; uploadFeedback.className = 'form-feedback'; }
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Subiendo...';

          // Armamos el objeto bimestres: b1..b5 -> { <materia>: color, inasistencias }
          const bimestres = Object.fromEntries(BIMESTRES.map(b => {
            const entry = { inasistencias: gradeInasistencias[b] };
            gradeSubjects.forEach(s => {
              if(s.ratings[b]) entry[s.name] = s.ratings[b];
            });
            return [b, entry];
          }));

          try {
            const res = await fetch(`${AUTH_BACKEND_URL}/api/grades/${selectedStudentId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bimestres })
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Error al subir calificaciones');

            const student = gradeStudents.find(s => s.id === selectedStudentId);
            if(student) student.bimestres = bimestres;

            if(uploadFeedback){ uploadFeedback.textContent = 'Calificaciones subidas correctamente.'; uploadFeedback.classList.add('success'); }
          } catch (err) {
            if(uploadFeedback){ uploadFeedback.textContent = err.message || 'No se pudieron subir las calificaciones.'; uploadFeedback.classList.add('error'); }
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Subir calificaciones';
          }
        });
      }
    }

    // Si renderizamos la sección asistencias, añadimos listeners para el selector, navegación y días
    if(action === 'asistencias'){
      const studentSelect = document.getElementById('attStudentSelect');
      const prevBtn = document.getElementById('attPrevMonth');
      const nextBtn = document.getElementById('attNextMonth');
      const dayBtns = document.querySelectorAll('[data-att-day]');
      const uploadBtn = document.getElementById('uploadAttendanceBtn');
      const uploadFeedback = document.getElementById('attendanceUploadFeedback');

      // Cargamos la lista de alumnos (reutilizamos la colección "grades") una sola vez
      if(attendanceStudents.length === 0){
        (async () => {
          try {
            const res = await fetch(`${AUTH_BACKEND_URL}/api/grades`);
            if(!res.ok) throw new Error('Error en el servidor');
            const data = await res.json();
            attendanceStudents = data.students || [];
            renderSection('asistencias');
          } catch (err) {
            console.error('Error cargando alumnos:', err);
          }
        })();
      }

      if(studentSelect){
        studentSelect.addEventListener('change', () => {
          attendanceStudentId = studentSelect.value || null;
          attendanceDays = {};
          if(!attendanceStudentId){ renderSection('asistencias'); return; }

          (async () => {
            try {
              const res = await fetch(`${AUTH_BACKEND_URL}/api/asistencia/${attendanceStudentId}`);
              if(!res.ok) throw new Error('Error en el servidor');
              const data = await res.json();
              attendanceDays = data.days || {};
            } catch (err) {
              console.error('Error cargando asistencia:', err);
            } finally {
              renderSection('asistencias');
            }
          })();
        });
      }

      if(prevBtn){
        prevBtn.addEventListener('click', () => {
          attendanceViewDate = new Date(attendanceViewDate.getFullYear(), attendanceViewDate.getMonth() - 1, 1);
          renderSection('asistencias');
        });
      }
      if(nextBtn){
        nextBtn.addEventListener('click', () => {
          attendanceViewDate = new Date(attendanceViewDate.getFullYear(), attendanceViewDate.getMonth() + 1, 1);
          renderSection('asistencias');
        });
      }

      dayBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          if(!attendanceStudentId) return;
          const key = btn.getAttribute('data-att-day');
          const current = attendanceDays[key];
          // ciclo: sin marcar -> presente (true) -> ausente (false) -> sin marcar
          if(current === undefined) attendanceDays[key] = true;
          else if(current === true) attendanceDays[key] = false;
          else delete attendanceDays[key];
          renderSection('asistencias');
        });
      });

      if(uploadBtn){
        uploadBtn.addEventListener('click', async () => {
          if(!attendanceStudentId) return;
          if(uploadFeedback){ uploadFeedback.textContent = ''; uploadFeedback.className = 'form-feedback'; }
          uploadBtn.disabled = true;
          uploadBtn.textContent = 'Guardando...';

          try {
            const res = await fetch(`${AUTH_BACKEND_URL}/api/asistencia/${attendanceStudentId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ days: attendanceDays })
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Error al guardar asistencia');

            if(uploadFeedback){ uploadFeedback.textContent = 'Asistencia guardada correctamente.'; uploadFeedback.classList.add('success'); }
          } catch (err) {
            if(uploadFeedback){ uploadFeedback.textContent = err.message || 'No se pudo guardar la asistencia.'; uploadFeedback.classList.add('error'); }
          } finally {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Guardar asistencia';
          }
        });
      }
    }

    // Si renderizamos la sección calendario, añadimos listeners para navegación y formulario
    if(action === 'calendario'){
      const prevBtn = document.getElementById('calPrevMonth');
      const nextBtn = document.getElementById('calNextMonth');
      const form = document.getElementById('periodForm');
      const feedback = document.getElementById('periodFeedback');
      const deleteBtns = document.querySelectorAll('[data-delete-period]');

      if(prevBtn){
        prevBtn.addEventListener('click', () => {
          calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
          renderSection('calendario');
        });
      }

      if(nextBtn){
        nextBtn.addEventListener('click', () => {
          calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
          renderSection('calendario');
        });
      }

      deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-period');
          const idx = calendarPeriods.findIndex(p => String(p.id) === id);
          if(idx !== -1) calendarPeriods.splice(idx, 1);
          renderSection('calendario');
        });
      });

      if(form){
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if(feedback){ feedback.textContent = ''; feedback.className = 'form-feedback'; }

          const title = document.getElementById('periodTitle').value.trim();
          const color = document.getElementById('periodColor').value;
          const start = document.getElementById('periodStart').value;
          const end = document.getElementById('periodEnd').value;

          if(!title || !start || !end){
            if(feedback){ feedback.textContent = 'Completa el título y ambas fechas.'; feedback.classList.add('error'); }
            return;
          }
          if(start > end){
            if(feedback){ feedback.textContent = 'La fecha de inicio no puede ser posterior a la fecha de fin.'; feedback.classList.add('error'); }
            return;
          }

          const period = { id: Date.now(), title, color, start, end };
          calendarPeriods.push(period);
          // Mostramos el mes en el que inicia el nuevo periodo
          calendarViewDate = toDateOnly(start);
          renderSection('calendario');

          try {
            const BACKEND_URL = 'https://admin-panel-rousseau.onrender.com';
            const res = await fetch(`${BACKEND_URL}/api/calendar`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ title, color, start, end })
            });
            if(!res.ok) throw new Error('Error en el servidor');
          } catch (err) {
            console.error('No se pudo guardar el periodo en la base de datos:', err);
          }
        });
      }
    }

    // Si renderizamos la sección alimentos, añadimos listeners para el formulario
    if(action === 'alimentos'){
      const form = document.getElementById('foodForm');
      const feedback = document.getElementById('foodFeedback');
      const cancelBtn = document.getElementById('foodCancel');
      const editBtns = document.querySelectorAll('[data-edit-day]');

      editBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          editingDay = btn.getAttribute('data-edit-day');
          renderSection('alimentos');
        });
      });

      if(form){
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if(feedback){ feedback.textContent = ''; feedback.className = 'form-feedback'; }

          const day = document.getElementById('foodDay').value;
          const meal = document.getElementById('foodMeal').value.trim();
          const dessert = document.getElementById('foodDessert').value.trim();
          const drink = document.getElementById('foodDrink').value.trim();

          if(!day || !meal){
            if(feedback){ feedback.textContent = 'Por favor completa el día y la comida.'; feedback.classList.add('error'); }
            return;
          }

          const payload = { day, meal, dessert, drink };

          try {
            // Nota: endpoint temporal '/api/food' — en el siguiente paso se conectará a la base de datos
            const BACKEND_URL = 'https://admin-panel-rousseau.onrender.com';
            const res = await fetch(`${BACKEND_URL}/api/food`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if(!res.ok) throw new Error('Error en el servidor');
          } catch (err) {
            console.error(err);
          }

          // Guardamos el menú del día localmente y salimos del modo edición
          foodMenus[day] = { meal, dessert, drink };
          editingDay = null;
          renderSection('alimentos');
        });
      }

      if(cancelBtn){
        cancelBtn.addEventListener('click', () => {
          if(editingDay){
            // Cancelar edición: volvemos al flujo normal sin perder lo ya guardado
            editingDay = null;
            renderSection('alimentos');
            return;
          }
          renderSection('inicio');
          items.forEach(i => i.classList.remove('active'));
          const inicioBtn = document.querySelector('.nav-item[data-action="inicio"]');
          if(inicioBtn) inicioBtn.classList.add('active');
        });
      }

      const sendMenuBtn = document.getElementById('foodSendMenu');
      const sendFeedback = document.getElementById('foodSendFeedback');

      if(sendMenuBtn){
        sendMenuBtn.addEventListener('click', async () => {
          if(sendFeedback){ sendFeedback.textContent = ''; sendFeedback.className = 'form-feedback'; }
          sendMenuBtn.disabled = true;

          try {
            const BACKEND_URL = 'https://admin-panel-rousseau.onrender.com';
            const res = await fetch(`${BACKEND_URL}/api/menu`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ days: foodMenus })
            });

            if(!res.ok) throw new Error('Error en el servidor');

            if(sendFeedback){ sendFeedback.textContent = 'Menú enviado correctamente a la base de datos.'; sendFeedback.classList.add('success'); }
          } catch (err) {
            console.error(err);
            if(sendFeedback){ sendFeedback.textContent = 'No se pudo enviar el menú a la base de datos.'; sendFeedback.classList.add('error'); }
          } finally {
            sendMenuBtn.disabled = false;
          }
        });
      }
    }
  }

  items.forEach(item => {
    item.addEventListener('click', () => {
      setActive(item);
      const action = item.getAttribute('data-action');
      if (action) {
        renderSection(action);
      }
      closeMobileSidebar();
    });
  });

  // Delegación de eventos: adminContent se reemplaza al navegar (ej. al volver a "Inicio"
  // se restaura inicioHTML como elementos nuevos), así que un listener por tarjeta se perdería.
  // Escuchamos en adminContent, que nunca se destruye, y buscamos la tarjeta desde el target del click.
  adminContent.addEventListener('click', (e) => {
    const card = e.target.closest('.quick-access [data-action]');
    if (!card) return;
    const action = card.getAttribute('data-action');
    const navItem = sidebarNav.querySelector(`.nav-item[data-action="${action}"]`);
    if (navItem) setActive(navItem);
    if (action) renderSection(action);
  });
});