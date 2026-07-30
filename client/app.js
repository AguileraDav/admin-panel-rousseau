document.addEventListener('DOMContentLoaded', () => {
  const sidebarNav = document.querySelector('.sidebar-nav');
  const items = sidebarNav.querySelectorAll('.nav-item');
  const adminContent = document.getElementById('adminContent');
  
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
  // Bimestres: cada materia tiene una calificación (estrella) independiente por bimestre
  const BIMESTRES = ['B1', 'B2', 'B3', 'B4', 'B5'];
  // rating por bimestre: null (sin calificar), 'destacado' (verde), 'proceso' (amarillo), 'dificulta' (rojo)
  const gradeSubjects = DEFAULT_SUBJECTS.map((name, i) => ({
    id: `subj-${i}`,
    name,
    ratings: Object.fromEntries(BIMESTRES.map(b => [b, null]))
  }));
  const RATING_CYCLE = [null, 'destacado', 'proceso', 'dificulta'];
  const RATING_LABELS = { destacado: 'Destacado', proceso: 'En proceso', dificulta: 'Se le dificulta' };

  function buildGradesHTML(){
    const rowsHTML = gradeSubjects.map(s => {
      const starsHTML = BIMESTRES.map(b => {
        const rating = s.ratings[b];
        const starClass = rating ? `star-${rating}` : 'star-empty';
        const label = rating ? RATING_LABELS[rating] : 'Sin calificar';
        return `<button type="button" class="star-btn ${starClass}" data-toggle-rating="${s.id}" data-bimestre="${b}" title="${b}: ${label}">★</button>`;
      }).join('');
      return `
        <tr>
          <td>${s.name}</td>
          <td class="grade-star-cell">${starsHTML}</td>
          <td><button type="button" class="cal-legend-delete" data-delete-subject="${s.id}" aria-label="Eliminar materia">✕</button></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="calendar-section">
        <table class="grades-table">
          <thead>
            <tr><th>Materia</th><th class="grade-star-cell">${BIMESTRES.map(b => `<span class="grade-bimestre-label">${b}</span>`).join('')}</th><th></th></tr>
          </thead>
          <tbody>${rowsHTML}</tbody>
        </table>

        <div class="grades-legend">
          <span><span class="star-btn star-destacado">★</span> Destacado</span>
          <span><span class="star-btn star-proceso">★</span> En proceso</span>
          <span><span class="star-btn star-dificulta">★</span> Se le dificulta</span>
        </div>

        <h3 class="cal-form-title">Agregar materia</h3>
        <form id="subjectForm" class="event-form">
          <div class="form-row">
            <label for="subjectName">Nombre de la materia</label>
            <input type="text" id="subjectName" name="name" placeholder="Ej. Música" required />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-primary">Agregar materia</button>
          </div>
          <div id="subjectFeedback" class="form-feedback" aria-live="polite"></div>
        </form>
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
        html = `<h2>Registro de Pagos</h2><p>Control de estado financiero por alumno.</p>`;
        break;
      case 'calificaciones':
        html = `
          <h2>Calificaciones por Materia</h2>
          <p>Haz clic en la estrella para calificar: verde (destacado), amarillo (en proceso), rojo (se le dificulta).</p>
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
      case 'perfil':
        html = `<h2>Configuración de Perfil</h2><p>Ajusta las credenciales de tu cuenta de administrador.</p>`;
        break;
      default:
        html = `<h2>Sección: ${action}</h2><p>Contenido en desarrollo...</p>`;
    }
    
    // Envolvemos en un contenedor estándar para que no se pegue crudo
    adminContent.innerHTML = `<section class="generic-section" style="background:white; padding: 40px; border-radius: var(--radius); box-shadow: 0 4px 15px rgba(0,0,0,0.02)">${html}</section>`;

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

    // Si renderizamos la sección calificaciones, añadimos listeners para las estrellas y el formulario
    if(action === 'calificaciones'){
      const starBtns = document.querySelectorAll('[data-toggle-rating]');
      const deleteBtns = document.querySelectorAll('[data-delete-subject]');
      const form = document.getElementById('subjectForm');
      const feedback = document.getElementById('subjectFeedback');

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

      deleteBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-delete-subject');
          const idx = gradeSubjects.findIndex(s => s.id === id);
          if(idx !== -1) gradeSubjects.splice(idx, 1);
          renderSection('calificaciones');
        });
      });

      if(form){
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          if(feedback){ feedback.textContent = ''; feedback.className = 'form-feedback'; }

          const nameInput = document.getElementById('subjectName');
          const name = nameInput.value.trim();
          if(!name){
            if(feedback){ feedback.textContent = 'Escribe el nombre de la materia.'; feedback.classList.add('error'); }
            return;
          }

          gradeSubjects.push({ id: `subj-${Date.now()}`, name, ratings: Object.fromEntries(BIMESTRES.map(b => [b, null])) });
          renderSection('calificaciones');
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
    });
  });
});