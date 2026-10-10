import { useEffect, useMemo, useState } from 'react';
import {
  changeRoleByEmail,
  assignWastePickup,
  createWastePickup,
  createDepartment,
  deleteCategory,
  deleteDepartment,
  getCategories,
  getAdminPetitions,
  getAdminProjects,
  getAdminWastePickups,
  getAshaWorkers,
  getAssignedWastePickups,
  getCivicSyncRole,
  getDepartments,
  getLocalitySuggestions,
  getPetitions,
  getProjects,
  getResidentVerification,
  getResidentWastePickups,
  getScheduleConflicts,
  getUpdates,
  renameDepartment,
  reviewPetition,
  saveProjectCheckpoint,
  saveResidentVerification,
  saveCategory,
  savePublicWork,
  submitPetition,
  updateWastePickupStatus,
} from './services/civicStore';
import { lookupKeralaPincode } from './services/postalService';
import { supabase } from './utils/supabase';
import './App.css';

const navigation = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'projects', label: 'Public works', icon: 'work' },
  { id: 'petitions', label: 'Community petitions', icon: 'petition' },
  { id: 'waste', label: 'Household pickup', icon: 'water' },
  { id: 'updates', label: 'Updates & notices', icon: 'bell' },
];

function Icon({ name, size = 19 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  };
  const shapes = {
    grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
    work: <><path d="M3 8h18v12H3z" /><path d="M8 8V5h8v3M3 12h18M10 12v2h4v-2" /></>,
    petition: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    alert: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    water: <path d="M12 22a7 7 0 0 0 7-7c0-4-7-13-7-13S5 11 5 15a7 7 0 0 0 7 7Z" />,
    road: <><path d="M5 21 9 3M19 21 15 3M12 6v3M12 12v3M12 18v3" /></>,
    power: <path d="m13 2-3 8h7l-6 12 1-9H5l8-11Z" />,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
    moon: <path d="M20.8 13A8.5 8.5 0 0 1 11 3.2 8.5 8.5 0 1 0 20.8 13Z" />,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  };
  return <svg {...common}>{shapes[name]}</svg>;
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status.toLowerCase().replaceAll(' ', '-')}`}><span />{status}</span>;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`));
}

function readSavedTheme() {
  try {
    return window.localStorage.getItem('civicsync-theme') === 'dark' ? 'dark' : 'light';
  } catch (error) {
    console.warn('Theme preference could not be loaded; using light mode.', error);
    return 'light';
  }
}

function ProjectCard({ project, allProjects, onSelect }) {
  const conflicts = getScheduleConflicts(project, allProjects);
  const categoryIcon = project.category.startsWith('Road') ? 'road' : project.category.startsWith('Water') ? 'water' : 'power';
  const categoryTone = project.category.startsWith('Road') ? 'roads' : project.category.startsWith('Water') ? 'water' : 'power';
  return (
    <article className="project-card">
      <div className="project-card-top"><span className={`category-icon category-${categoryTone}`}><Icon name={categoryIcon} size={19} /></span><StatusBadge status={project.status} /></div>
      <p className="project-category">{project.category} <span>·</span> {project.id}</p>
      <h3>{project.title}</h3>
      <p className="project-description">{project.description}</p>
      <div className="project-meta"><span><Icon name="pin" size={15} />{project.locality}</span><span><Icon name="calendar" size={15} />{formatDate(project.startDate)} – {formatDate(project.endDate)}</span></div>
      {conflicts.length > 0 && <div className="conflict-note"><Icon name="alert" size={15} /> Overlaps with {conflicts[0].title}</div>}
      <div className="project-card-footer"><span>{project.department}</span><button type="button" className="icon-link" onClick={() => onSelect(project)} aria-label={`View ${project.title}`}><Icon name="arrow" size={17} /></button></div>
    </article>
  );
}

function ProjectDialog({ project, allProjects, onClose }) {
  if (!project) return null;
  const conflicts = getScheduleConflicts(project, allProjects);
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="project-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close project details"><Icon name="close" /></button>
        <div className="dialog-kicker">{project.category} <span>·</span> {project.id}</div><StatusBadge status={project.status} />
        <h2 id="dialog-title">{project.title}</h2><p className="dialog-description">{project.description}</p>
        <div className="dialog-facts">
          <div><span>AFFECTED LOCALITY</span><strong>{project.locality} · {project.pin}</strong></div>
          <div><span>RESPONSIBLE DEPARTMENT</span><strong>{project.department}</strong></div>
          <div><span>SCHEDULE</span><strong>{formatDate(project.startDate)} – {formatDate(project.endDate)}</strong></div>
          <div><span>EXPECTED DISRUPTION</span><strong>{project.disruption}</strong></div>
        </div>
        {conflicts.length > 0 && <div className="dialog-conflict"><Icon name="alert" size={18} /><span><strong>Schedule coordination note</strong><br />This schedule overlaps with {conflicts.map((item) => item.title).join(', ')}. This is a planning flag, not an official conflict decision.</span></div>}
        <h3 className="timeline-heading">Public project timeline</h3>
        {project.timeline.length ? <ol className="timeline">{project.timeline.map((item, index) => <li key={`${project.id}-${index}`}><span className="timeline-dot" /><div><time>{item.date}</time><strong>{item.title}</strong><p>{item.detail}</p><small><Icon name="shield" size={13} /> Published by {item.department}</small></div></li>)}</ol> : <p className="empty-timeline">No public timeline entries have been published yet.</p>}
        <p className="dialog-sample-note">Public information published through CivicSync. Confirm critical disruption details with the listed department.</p>
      </section>
    </div>
  );
}

function AuthDialog({ onClose, onVerified }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submitEmail(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (authError) { setError(`Could not send your sign-in code: ${authError.message}`); return; }
    setSent(true);
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { data, error: authError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (authError) { setError(`Could not verify that code: ${authError.message}`); return; }
    onVerified(data.session);
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close sign-in"><Icon name="close" /></button>
        <span className="auth-icon"><Icon name="mail" size={21} /></span><p className="dialog-kicker">SECURE CITIZEN ACCESS</p>
        <h2 id="auth-title">{sent ? 'Check your email' : 'Sign in to CivicSync'}</h2>
        <p className="dialog-description">{sent ? `Enter the one-time code sent to ${email}.` : 'Use an email one-time code to submit a request and privately track its status.'}</p>
        {!sent ? <form onSubmit={submitEmail}><label htmlFor="auth-email">Email address</label><input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Sending…' : 'Send sign-in code'}</button></form>
          : <form onSubmit={verifyCode}><label htmlFor="auth-code">One-time code</label><input id="auth-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} minLength="6" maxLength="8" required /><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify and continue'}</button><button type="button" className="plain-link auth-resend" onClick={() => { setSent(false); setCode(''); }}>Use a different email</button></form>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="auth-privacy">Email sign-in is handled by Supabase. Petitions require a private resident profile; household pickup requests also require verified phone OTP.</p>
      </section>
    </div>
  );
}

function ResidentVerificationDialog({ session, residentProfile, onClose, onVerified, requirePhone = true }) {
  const [fullName, setFullName] = useState(residentProfile?.full_name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(residentProfile?.date_of_birth ?? '');
  const [phone, setPhone] = useState(session.user.phone ?? '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function saveAndSendCode(event) {
    event.preventDefault();
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (requirePhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError('Enter a phone number in international format, such as +919876543210.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveResidentVerification(session.user.id, fullName, dateOfBirth);
      if (!requirePhone) {
        onVerified(session, { full_name: fullName.trim(), date_of_birth: dateOfBirth });
        return;
      }
      if (session.user.phone_confirmed_at && session.user.phone === normalizedPhone) {
        onVerified(session, { full_name: fullName.trim(), date_of_birth: dateOfBirth });
        return;
      }
      const { error: phoneError } = await supabase.auth.updateUser({ phone: normalizedPhone });
      if (phoneError) throw new Error(`Could not send a phone verification code: ${phoneError.message}`, { cause: phoneError });
      setSent(true);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const normalizedPhone = phone.replace(/[\s()-]/g, '');
      const { data: verifiedData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: code.trim(),
        type: 'phone_change',
      });
      if (verifyError) throw new Error(`Could not verify that phone code: ${verifyError.message}`, { cause: verifyError });
      let nextSession = verifiedData.session;
      if (!nextSession) {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(`Phone was verified, but the updated session could not be loaded: ${sessionError.message}`, { cause: sessionError });
        nextSession = data.session;
      }
      if (!nextSession) throw new Error('Phone was verified, but CivicSync could not refresh your sign-in session. Please sign in again.');
      onVerified(nextSession, { full_name: fullName.trim(), date_of_birth: dateOfBirth });
    } catch (verifyError) {
      setError(verifyError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog resident-verification-dialog" role="dialog" aria-modal="true" aria-labelledby="resident-verification-title">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close resident verification"><Icon name="close" /></button>
        <span className="auth-icon"><Icon name="shield" size={21} /></span><p className="dialog-kicker">PRIVATE RESIDENT DETAILS</p>
        <h2 id="resident-verification-title">{sent ? 'Verify your phone' : requirePhone ? 'Complete resident verification' : 'Add your resident details'}</h2>
        <p className="dialog-description">{sent ? `Enter the SMS code sent to ${phone}.` : requirePhone ? 'Add your name and date of birth, then confirm you can receive an SMS at your phone number.' : 'Add your name and date of birth to submit a community petition. Phone verification is not required for petitions.'}</p>
        {!sent ? <form onSubmit={saveAndSendCode}>
          <label htmlFor="resident-full-name">Full legal name</label><input id="resident-full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={160} />
          <label htmlFor="resident-date-of-birth">Date of birth</label><input id="resident-date-of-birth" type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} required />
          {requirePhone && <><label htmlFor="resident-phone">Mobile phone</label><input id="resident-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" value={phone} onChange={(event) => setPhone(event.target.value)} required /></>}
          <div className="form-privacy"><Icon name="shield" size={16} /> Name and date of birth are private to your account. {requirePhone ? 'Phone OTP verifies phone access; it is not government identity verification.' : 'These details are self-reported and are not government identity verification.'}</div>
          <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Saving…' : requirePhone ? 'Save details and send OTP' : 'Save details and continue'}</button>
        </form> : <form onSubmit={verifyPhone}>
          <label htmlFor="resident-phone-code">SMS one-time code</label><input id="resident-phone-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} minLength={4} maxLength={8} required />
          <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify phone and continue'}</button>
          <button type="button" className="plain-link auth-resend" onClick={() => { setSent(false); setCode(''); }}>Change details or phone number</button>
        </form>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="auth-privacy">{requirePhone ? 'SMS phone verification must be enabled and configured in Supabase Auth. Date of birth is self-reported and is not independently validated.' : 'Date of birth is self-reported and is not independently validated.'}</p>
      </section>
    </div>
  );
}

function PetitionDialog({ pin, localities, onClose, onSubmit }) {
  const [form, setForm] = useState({ title: '', category: '', locality: '', description: '', reason: '' });
  const [categories, setCategories] = useState([]);
  const [localityOptions, setLocalityOptions] = useState(localities);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCategories('for_petitions')
      .then((items) => {
        if (!active) return;
        setCategories(items);
        setForm((current) => ({ ...current, category: current.category || items[0]?.name || '' }));
      })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, []);

  function update(event) { setForm({ ...form, [event.target.name]: event.target.value }); }
  async function loadLocalities() {
    try {
      setLocalityOptions(await getLocalitySuggestions(pin));
    } catch (loadError) {
      setError(loadError.message);
    }
  }
  async function submit(event) {
    event.preventDefault();
    if (form.description.trim().length < 20) { setError('Please describe the issue in at least 20 characters.'); return; }
    setBusy(true);
    setError('');
    try { await onSubmit({ ...form, pin }); } catch (submitError) { setError(submitError.message); } finally { setBusy(false); }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="petition-dialog" role="dialog" aria-modal="true" aria-labelledby="petition-title">
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close petition form"><Icon name="close" /></button>
        <p className="dialog-kicker">COMMUNITY VOICE</p><h2 id="petition-title">Request an improvement</h2>
        <p className="dialog-description">Your request is visible only to you and authorized reviewers. Approval creates an unpublished draft project for staff to review; it is not a government commitment.</p>
        <form onSubmit={submit}>
          <label htmlFor="petition-title-input">Request title</label><input id="petition-title-input" name="title" value={form.title} onChange={update} placeholder="e.g. Repair the footpath near the market" required maxLength={100} />
          <div className="form-grid">
            <div><label htmlFor="petition-category">Improvement type</label><select id="petition-category" name="category" value={form.category} onChange={update} required disabled={!categories.length}><option value="">{categories.length ? 'Select a category' : 'No categories available'}</option>{categories.map((category) => <option key={category.name}>{category.name}</option>)}</select></div>
            <div><label htmlFor="petition-locality">Affected locality</label><input id="petition-locality" name="locality" value={form.locality} onFocus={loadLocalities} onChange={update} placeholder="Start typing a place name" autoComplete="address-level2" list="petition-locality-options" required maxLength={120} /><datalist id="petition-locality-options">{localityOptions.map((name) => <option key={name} value={name} />)}</datalist></div>
          </div>
          <label htmlFor="petition-description">What needs attention?</label><textarea id="petition-description" name="description" value={form.description} onChange={update} placeholder="Describe what is happening. Avoid personal or sensitive information." rows="4" minLength="20" maxLength="5000" required />
          <label htmlFor="petition-reason">Why is this important? <span>Optional</span></label><textarea id="petition-reason" name="reason" value={form.reason} onChange={update} placeholder="Who is affected, and what would improve?" rows="2" maxLength="2000" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-privacy"><Icon name="shield" size={16} /> Your submission is associated with your account and is not shown publicly.</div>
          <div className="form-actions"><button type="button" className="button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button-primary" disabled={busy || !categories.length}><Icon name="plus" size={17} />{busy ? 'Submitting…' : 'Submit request'}</button></div>
        </form>
      </section>
    </div>
  );
}

const workStatuses = ['draft', 'under_review', 'scheduled', 'in_progress', 'postponed', 'completed', 'cancelled'];
const petitionStatuses = ['submitted', 'under_review', 'approved', 'rejected', 'revision_requested'];
const pickupStatuses = {
  requested: 'Requested',
  assigned: 'Worker assigned',
  on_the_way: 'On the way',
  at_door: 'At your home',
  bag_collected: 'Bag picked up',
  completed: 'Pickup complete',
  unable_to_collect: 'Could not collect',
};

function PetitionReviewForm({ petition, departments, categories, busy, onSubmit }) {
  const [status, setStatus] = useState(petition.status.toLowerCase().replaceAll(' ', '_'));
  return (
    <form className="admin-review-form" onSubmit={onSubmit}>
      <label>Status<select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>{petitionStatuses.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}</select></label>
      <label>Response for the petitioner<textarea name="response" rows="2" maxLength="3000" defaultValue={petition.response} placeholder="Share an update or explain the decision." /></label>
      {status === 'approved' && !petition.publicWorkId && <div className="draft-project-fields">
        <strong>Approval creates a linked draft project</strong>
        <p>Choose the responsible department and planning dates. The draft stays unpublished until staff review and publish it.</p>
        <label>Responsible department<select name="project_department" required><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        <label>Public-work category<select name="project_category" required defaultValue={categories.find((category) => category.name === petition.category && category.is_active && category.for_projects)?.name ?? ''}><option value="">Select category</option>{categories.filter((category) => category.is_active && category.for_projects).map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</select></label>
        <div className="form-grid">
          <label>Planning start<input type="date" name="project_start" required /></label>
          <label>Planning end<input type="date" name="project_end" required /></label>
        </div>
      </div>}
      {petition.publicWorkId && <p className="field-hint">Linked draft project: {petition.publicWorkCode || petition.publicWorkId}. Edit and publish it from Projects.</p>}
      <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save review'}</button>
    </form>
  );
}

async function fetchAdminData(role) {
  const requests = [
    getAdminProjects(),
    getAdminPetitions(),
    getDepartments(),
    getCategories(),
  ];
  if (role === 'admin') requests.push(getAdminWastePickups(), getAshaWorkers());
  const results = await Promise.allSettled(requests);
  const [projects, petitions, departments, categories, pickups, workers] = results;
  return {
    projects: projects.status === 'fulfilled' ? projects.value : [],
    petitions: petitions.status === 'fulfilled' ? petitions.value : [],
    departments: departments.status === 'fulfilled' ? departments.value : [],
    categories: categories.status === 'fulfilled' ? categories.value : [],
    pickups: pickups?.status === 'fulfilled' ? pickups.value : [],
    workers: workers?.status === 'fulfilled' ? workers.value : [],
    errors: results.filter((result) => result.status === 'rejected').map((result) => result.reason.message),
  };
}

function AdminPanel({ session, profile, onNotice }) {
  const { role } = profile;
  const [section, setSection] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [pickups, setPickups] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [projectForm, setProjectForm] = useState(null);
  const [localityOptions, setLocalityOptions] = useState([]);
  const [verifiedPin, setVerifiedPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [roleEmail, setRoleEmail] = useState('');
  const [roleName, setRoleName] = useState('admin');
  const [roleDepartment, setRoleDepartment] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [checkpointProjectId, setCheckpointProjectId] = useState('');
  const [checkpointTitle, setCheckpointTitle] = useState('');
  const [checkpointDescription, setCheckpointDescription] = useState('');
  const canManageAccess = role === 'admin';
  const canVerifyPetitions = role === 'admin';

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAdminData(role);
      setProjects(data.projects);
      setPetitions(data.petitions);
      setPickups(data.pickups);
      setWorkers(data.workers);
      setDepartments(data.departments);
      setCategories(data.categories);
      setError(data.errors.join(' '));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const data = await fetchAdminData(role);
        if (active) {
          setProjects(data.projects);
          setPetitions(data.petitions);
          setPickups(data.pickups);
          setWorkers(data.workers);
          setDepartments(data.departments);
          setCategories(data.categories);
          setError(data.errors.join(' '));
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [role]);

  function startNewProject() {
    setVerifiedPin('');
    setLocalityOptions([]);
    setProjectForm({
      title: '', description: '', pin: '', locality: '', departmentId: profile.department_id ?? departments[0]?.id ?? '',
      category: categories.find((category) => category.is_active && category.for_projects)?.name ?? '', status: 'draft', startDate: '', endDate: '', disruption: '', isPublished: false,
    });
    setError('');
  }

  function editProject(project) {
    setVerifiedPin(project.pin);
    setProjectForm({
      recordId: project.recordId, title: project.title, description: project.description, pin: project.pin,
      locality: project.locality, departmentId: departments.find((department) => department.name === project.department)?.id ?? '',
      category: project.category, status: project.status.toLowerCase().replaceAll(' ', '_'),
      startDate: project.startDate, endDate: project.endDate, disruption: project.disruption,
      isPublished: project.isPublished,
    });
    getLocalitySuggestions(project.pin).then(setLocalityOptions).catch((loadError) => setError(loadError.message));
    setSection('projects');
    setError('');
  }

  async function verifyProjectPin() {
    setPinBusy(true);
    setError('');
    try {
      const pin = projectForm.pin.trim();
      const offices = await lookupKeralaPincode(pin);
      const suggestions = await getLocalitySuggestions(pin);
      setLocalityOptions([...new Set([...offices, ...suggestions])]);
      setVerifiedPin(pin);
      onNotice(`PIN ${pin} verified. Localities now include postal office names and previously used place names.`);
    } catch (verifyError) {
      setVerifiedPin('');
      setError(verifyError.message);
    } finally {
      setPinBusy(false);
    }
  }

  async function submitProject(event) {
    event.preventDefault();
    if (verifiedPin !== projectForm.pin.trim()) {
      setError('Verify this Kerala PIN before saving the project.');
      return;
    }
    if (projectForm.isPublished && ['draft', 'under_review'].includes(projectForm.status)) {
      setError('Set the project status to scheduled, in progress, postponed, completed, or cancelled before publishing it.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await savePublicWork(projectForm, session.user.id);
      setProjectForm(null);
      await refresh();
      onNotice(projectForm.recordId ? 'Project updated.' : 'Project created.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event, petition) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await reviewPetition(petition.recordId, form.get('status'), form.get('response'), {
        departmentId: form.get('project_department'),
        category: form.get('project_category'),
        startDate: form.get('project_start'),
        endDate: form.get('project_end'),
      });
      await refresh();
      onNotice(form.get('status') === 'approved'
        ? `Petition ${petition.id} approved. Its draft public work is available in Projects for review and publication.`
        : `Petition ${petition.id} review saved.`);
    } catch (reviewError) {
      setError(reviewError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCheckpoint(event, project) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveProjectCheckpoint(project.recordId, { title: checkpointTitle, description: checkpointDescription }, false);
      setCheckpointProjectId('');
      setCheckpointTitle('');
      setCheckpointDescription('');
      await refresh();
      onNotice('Checkpoint saved privately. An administrator or coordinator can publish it to the project timeline.');
    } catch (checkpointError) {
      setError(checkpointError.message);
    } finally {
      setBusy(false);
    }
  }

  async function publishCheckpoint(project, checkpoint) {
    setBusy(true);
    setError('');
    try {
      await saveProjectCheckpoint(project.recordId, checkpoint, true);
      await refresh();
      onNotice('Checkpoint published to the project timeline.');
    } catch (checkpointError) {
      setError(checkpointError.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignPickup(pickupId, workerId) {
    if (!workerId) return;
    setBusy(true);
    setError('');
    try {
      await assignWastePickup(pickupId, workerId);
      await refresh();
      onNotice('Household pickup assigned to an ASHA Worker.');
    } catch (assignError) {
      setError(assignError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitRole(event) {
    event.preventDefault();
    const targetEmail = roleEmail.trim();
    setBusy(true);
    setError('');
    try {
      await changeRoleByEmail(targetEmail, roleName, roleName === 'department_official' ? roleDepartment : null);
      setRoleEmail('');
      await refresh();
      onNotice(`${targetEmail} is now assigned the ${roleName.replaceAll('_', ' ')} role.`);
    } catch (roleError) {
      setError(roleError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDepartment(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createDepartment(departmentName);
      setDepartmentName('');
      await refresh();
      onNotice('Department added.');
    } catch (departmentError) {
      setError(departmentError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitDepartmentEdit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await renameDepartment(editingDepartment.id, editingDepartment.name);
      setEditingDepartment(null);
      await refresh();
      onNotice('Department renamed.');
    } catch (renameError) {
      setError(renameError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeDepartment(department) {
    if (!window.confirm(`Remove "${department.name}"? Departments assigned to projects or staff cannot be removed.`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteDepartment(department.id);
      await refresh();
      onNotice('Department removed.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCategory(event, originalName) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = {
      name: String(form.get('name') ?? ''),
      forProjects: form.get('forProjects') === 'on',
      forPetitions: form.get('forPetitions') === 'on',
      isActive: form.get('isActive') === 'on',
    };
    if (!category.forProjects && !category.forPetitions) {
      setError('Choose whether this category is for projects, petitions, or both.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await saveCategory(originalName, category);
      await refresh();
      onNotice(originalName ? 'Category updated.' : 'Category added.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(category) {
    setBusy(true);
    setError('');
    try {
      await saveCategory(category.name, {
        name: category.name,
        forProjects: category.for_projects,
        forPetitions: category.for_petitions,
        isActive: !category.is_active,
      });
      await refresh();
      onNotice(category.is_active ? 'Category hidden from new forms.' : 'Category restored to new forms.');
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeCategory(category) {
    if (!window.confirm(`Permanently remove "${category.name}"? This works only if no project or petition uses it. To remove it from future forms, hide it instead.`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteCategory(category.name);
      await refresh();
      onNotice('Category removed.');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-overview">
        <div><p className="eyebrow">CIVICSYNC CONTROL ROOM</p><h2>Manage community work</h2><p>Create and publish local projects, review private citizen petitions, and manage trusted staff access.</p></div>
        <span className="admin-role-badge">{role.replaceAll('_', ' ')}</span>
      </div>
      <nav className="admin-tabs" aria-label="Control room sections">
        <button type="button" className={section === 'projects' ? 'active' : ''} onClick={() => setSection('projects')}>Projects <span>{projects.length}</span></button>
        <button type="button" className={section === 'petitions' ? 'active' : ''} onClick={() => setSection('petitions')}>Petition review <span>{petitions.filter((item) => ['Submitted', 'Under Review'].includes(item.status)).length}</span></button>
        {role === 'admin' && <button type="button" className={section === 'pickups' ? 'active' : ''} onClick={() => setSection('pickups')}>Waste pickup <span>{pickups.filter((item) => ['requested', 'assigned'].includes(item.status)).length}</span></button>}
        {canManageAccess && <button type="button" className={section === 'access' ? 'active' : ''} onClick={() => setSection('access')}>Access &amp; tags</button>}
      </nav>
      {error && <div className="data-error" role="alert"><Icon name="alert" size={17} /><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><Icon name="close" size={16} /></button></div>}
      {loading ? <div className="empty-state"><span className="loading-spinner" /><p>Loading secure control room data…</p></div> : <>
        {section === 'projects' && <section className="admin-section">
          <div className="admin-section-heading"><div><h3>Public works</h3><p>Only published work is visible to residents.</p></div><button type="button" className="button-primary" onClick={startNewProject}><Icon name="plus" size={16} /> Add project</button></div>
          {projectForm && <form className="admin-form" onSubmit={submitProject}>
            <div className="admin-form-heading"><h4>{projectForm.recordId ? 'Edit public work' : 'Create public work'}</h4><button type="button" className="button-secondary" onClick={() => setProjectForm(null)}>Cancel</button></div>
            <label>Project title<input required minLength="3" maxLength="180" value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} /></label>
            <label>Description<textarea required minLength="10" maxLength="10000" rows="3" value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></label>
            <div className="admin-form-grid">
              <label>Kerala PIN<input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" required value={projectForm.pin} onChange={(event) => { setProjectForm({ ...projectForm, pin: event.target.value.replace(/\D/g, '').slice(0, 6) }); setVerifiedPin(''); }} placeholder="e.g. 695001" /></label>
              <div className="admin-verify-pin"><button type="button" className="button-secondary" disabled={pinBusy || projectForm.pin.length !== 6} onClick={verifyProjectPin}>{pinBusy ? 'Checking…' : verifiedPin === projectForm.pin ? 'PIN verified' : 'Verify PIN'}</button></div>
              <label>Locality / place name<input required maxLength="160" list="admin-locality-options" value={projectForm.locality} onFocus={() => { if (verifiedPin) getLocalitySuggestions(verifiedPin).then(setLocalityOptions).catch((loadError) => setError(loadError.message)); }} onChange={(event) => setProjectForm({ ...projectForm, locality: event.target.value })} placeholder="Choose or type a place within this PIN" /><datalist id="admin-locality-options">{localityOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
              <label>Department<select required value={projectForm.departmentId} disabled={role === 'department_official'} onChange={(event) => setProjectForm({ ...projectForm, departmentId: event.target.value })}><option value="">{departments.length ? 'Select department' : 'No departments available'}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{departments.length === 0 && (role === 'admin' ? <button type="button" className="admin-inline-link" onClick={() => setSection('access')}>Add departments in Access &amp; tags</button> : <span className="field-hint">Ask an administrator to add departments.</span>)}</label>
              <label>Category<select required value={projectForm.category} onChange={(event) => setProjectForm({ ...projectForm, category: event.target.value })}><option value="">Select category</option>{categories.filter((category) => category.is_active && category.for_projects || category.name === projectForm.category).map((category) => <option key={category.name}>{category.name}</option>)}</select>{categories.every((category) => !category.is_active || !category.for_projects) && <button type="button" className="admin-inline-link" onClick={() => setSection('access')}>Add or restore categories in Access &amp; tags</button>}</label>
              <label>Status<select value={projectForm.status} onChange={(event) => setProjectForm({ ...projectForm, status: event.target.value })}>{workStatuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>
              <label>Start date<input type="date" required value={projectForm.startDate} onChange={(event) => setProjectForm({ ...projectForm, startDate: event.target.value })} /></label>
              <label>End date<input type="date" required min={projectForm.startDate} value={projectForm.endDate} onChange={(event) => setProjectForm({ ...projectForm, endDate: event.target.value })} /></label>
            </div>
            <label>Expected disruption <span className="field-hint">Optional</span><textarea rows="2" maxLength="2000" value={projectForm.disruption} onChange={(event) => setProjectForm({ ...projectForm, disruption: event.target.value })} /></label>
            {role === 'admin' || role === 'coordinator' ? <label className="admin-checkbox"><input type="checkbox" checked={projectForm.isPublished} onChange={(event) => setProjectForm({ ...projectForm, isPublished: event.target.checked })} /> Publish this project to residents</label> : <p className="field-hint">Projects created by department officials are saved as unpublished drafts for coordinator review.</p>}
            <button type="submit" className="button-primary" disabled={busy || !verifiedPin}>{busy ? 'Saving…' : projectForm.recordId ? 'Save project' : 'Create project'}</button>
          </form>}
          {projects.length === 0 ? <div className="empty-state"><h3>No projects yet</h3><p>Add an official public-work record to make it available for publication.</p></div> : <div className="admin-record-list">{projects.map((project) => <article className="admin-record admin-project-record" key={project.recordId}>
            <div><strong>{project.title}</strong><p>{project.locality} · PIN {project.pin} · {project.department}</p><span className={`admin-status ${project.status === 'Draft' || project.status === 'Under Review' ? 'unpublished' : ''}`}>{project.status}</span>
              <div className="checkpoint-list">{project.timeline.map((checkpoint) => <div className="checkpoint-row" key={checkpoint.recordId}><span><strong>{checkpoint.title}</strong><small>{checkpoint.date} · {checkpoint.isCheckpoint ? checkpoint.isPublic ? 'Published' : 'Pending approval' : 'System update'}</small><span>{checkpoint.detail}</span></span>{checkpoint.isCheckpoint && !checkpoint.isPublic && canVerifyPetitions && project.isPublished && <button type="button" className="button-secondary" disabled={busy} onClick={() => publishCheckpoint(project, checkpoint)}>Approve &amp; publish</button>}</div>)}</div>
              {checkpointProjectId === project.recordId ? <form className="checkpoint-form" onSubmit={(event) => submitCheckpoint(event, project)}><label>Checkpoint title<input required minLength={3} maxLength={180} value={checkpointTitle} onChange={(event) => setCheckpointTitle(event.target.value)} /></label><label>Update details<textarea required minLength={3} maxLength={3000} rows="2" value={checkpointDescription} onChange={(event) => setCheckpointDescription(event.target.value)} /></label><div><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save checkpoint'}</button><button type="button" className="button-secondary" onClick={() => setCheckpointProjectId('')}>Cancel</button></div></form>
                : <button type="button" className="admin-inline-link" onClick={() => { setCheckpointProjectId(project.recordId); setCheckpointTitle(''); setCheckpointDescription(''); }}>Add a project checkpoint</button>}
            </div><button type="button" className="button-secondary" onClick={() => editProject(project)}>Edit</button>
          </article>)}</div>}
        </section>}
        {section === 'petitions' && <section className="admin-section">
          <div className="admin-section-heading"><div><h3>Community petitions</h3><p>Private submissions are shown only to authorized reviewers and their owners.</p></div></div>
          {petitions.length === 0 ? <div className="empty-state"><h3>No petitions to review</h3><p>New submissions will appear here when residents send them.</p></div> : <div className="admin-record-list">{petitions.map((petition) => <article className="admin-petition" key={petition.recordId}>
            <div className="admin-record-title"><div><span className="petition-id">{petition.id} · {petition.submittedAt}</span><h4>{petition.title}</h4></div><span className="admin-status">{petition.status}</span></div>
            <p className="admin-petition-meta">{petition.category} · {petition.locality}, PIN {petition.pin}</p>
            <p className="admin-petition-description">{petition.description}</p>
            {petition.reason && <p className="admin-petition-reason"><strong>Why it matters:</strong> {petition.reason}</p>}
            {petition.publicWorkId && <p className="field-hint">Linked draft public work: {petition.publicWorkCode || petition.publicWorkId}</p>}
            {canVerifyPetitions && petition.userId !== session.user.id
              ? <PetitionReviewForm petition={petition} departments={departments} categories={categories} busy={busy} onSubmit={(event) => submitReview(event, petition)} />
              : <p className="field-hint">{canVerifyPetitions ? 'Admins cannot verify petitions submitted by their own account.' : 'Only administrators can verify petitions. You can review the status of your own submissions here.'}</p>}
          </article>)}</div>}
        </section>}
        {section === 'pickups' && role === 'admin' && <section className="admin-section">
          <div className="admin-section-heading"><div><h3>Household waste pickup</h3><p>Assign resident requests to an ASHA Worker. Their location details are private and shown only to the resident, Admins, and the assigned worker.</p></div></div>
          {!pickups.length ? <div className="empty-state"><h3>No pickup requests yet</h3><p>Verified residents can request a household bag pickup from the Household pickup page.</p></div> : <div className="admin-record-list">{pickups.map((pickup) => <article className="admin-petition" key={pickup.recordId}>
            <div className="admin-record-title"><div><span className="petition-id">{pickup.referenceCode} · {pickup.createdAt}</span><h4>{pickup.locality} · PIN {pickup.pin}</h4></div><span className="admin-status">{pickupStatuses[pickup.status]}</span></div>
            <p className="admin-petition-description"><strong>Pickup address:</strong> {pickup.address}</p>
            <p className="admin-petition-meta">{pickup.bagCount} bag{pickup.bagCount === 1 ? '' : 's'}{pickup.instructions ? ` · ${pickup.instructions}` : ''}</p>
            <label>Assign ASHA Worker<select value={pickup.assignedWorkerId ?? ''} disabled={busy || ['completed', 'bag_collected'].includes(pickup.status)} onChange={(event) => assignPickup(pickup.recordId, event.target.value)}><option value="">Unassigned</option>{workers.map((worker) => <option key={worker.worker_id} value={worker.worker_id}>{worker.full_name || worker.email}</option>)}</select></label>
          </article>)}</div>}
          {!workers.length && <p className="field-hint">No ASHA Worker accounts are available. Grant the ASHA Worker role under Access &amp; tags first.</p>}
        </section>}
        {section === 'access' && canManageAccess && <section className="admin-section">
          <div className="admin-access-grid">
          <form className="admin-form" onSubmit={submitRole}>
            <div><h3>Grant a CivicSync role</h3><p>The person must have already signed in at least once. This does not invite or create their account.</p></div>
            <label>Account email<input type="email" required value={roleEmail} onChange={(event) => setRoleEmail(event.target.value)} placeholder="person@example.com" /></label>
            <label>Role<select value={roleName} onChange={(event) => setRoleName(event.target.value)}><option value="admin">Administrator</option><option value="moderator">Moderator</option><option value="asha_worker">ASHA Worker (pickup route)</option><option value="coordinator">Coordinator</option><option value="department_official">Department official</option><option value="citizen">Citizen (remove staff access)</option></select></label>
            {roleName === 'department_official' && <label>Department<select required value={roleDepartment} onChange={(event) => setRoleDepartment(event.target.value)}><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}
            <button type="submit" className="button-primary" disabled={busy}>{busy ? 'Updating…' : 'Update account role'}</button>
          </form>
          <div className="admin-form">
            <div><h3>Departments</h3><p>Rename a department or remove it if it is not assigned to any project or staff account.</p></div>
            <form className="taxonomy-add-form" onSubmit={submitDepartment}><input required minLength="2" maxLength="120" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="e.g. Kerala Water Authority" aria-label="New department name" /><button type="submit" className="button-primary" disabled={busy}>{busy ? 'Saving…' : 'Add department'}</button></form>
            <div className="taxonomy-list">{departments.map((department) => editingDepartment?.id === department.id
              ? <form className="taxonomy-row" key={department.id} onSubmit={submitDepartmentEdit}><input required minLength="2" maxLength="120" value={editingDepartment.name} onChange={(event) => setEditingDepartment({ ...editingDepartment, name: event.target.value })} aria-label="Department name" /><button type="submit" className="button-primary" disabled={busy}>Save</button><button type="button" className="button-secondary" onClick={() => setEditingDepartment(null)}>Cancel</button></form>
              : <div className="taxonomy-row" key={department.id}><strong>{department.name}</strong><button type="button" className="button-secondary" onClick={() => setEditingDepartment({ id: department.id, name: department.name })}>Rename</button><button type="button" className="taxonomy-remove" disabled={busy} onClick={() => removeDepartment(department)}>Remove</button></div>)}</div>
          </div>
          </div>
          <section className="admin-form taxonomy-category-section">
            <div><h3>Project and petition categories</h3><p>Rename categories, choose which forms use them, or hide them from new submissions. Existing records retain archived categories.</p></div>
            <form className="taxonomy-row taxonomy-category-form" onSubmit={(event) => submitCategory(event, null)}>
              <input name="name" required minLength="2" maxLength="80" placeholder="New category name" aria-label="New category name" />
              <label><input type="checkbox" name="forProjects" defaultChecked /> Projects</label>
              <label><input type="checkbox" name="forPetitions" defaultChecked /> Petitions</label>
              <input type="hidden" name="isActive" value="on" />
              <button type="submit" className="button-primary" disabled={busy}>Add category</button>
            </form>
            {!categories.length && <p className="field-hint">No category tags loaded. Apply the department and category management migration to this Supabase project, then refresh.</p>}
            <div className="taxonomy-list">{categories.map((category) => <form className="taxonomy-row taxonomy-category-form" key={category.name} onSubmit={(event) => submitCategory(event, category.name)}>
              <input name="name" required minLength="2" maxLength="80" defaultValue={category.name} aria-label={`Edit category ${category.name}`} />
              <label><input type="checkbox" name="forProjects" defaultChecked={category.for_projects} /> Projects</label>
              <label><input type="checkbox" name="forPetitions" defaultChecked={category.for_petitions} /> Petitions</label>
              <label><input type="checkbox" name="isActive" defaultChecked={category.is_active} /> Active</label>
              <button type="submit" className="button-secondary" disabled={busy}>Save</button>
              <button type="button" className="button-secondary" disabled={busy} onClick={() => toggleCategory(category)}>{category.is_active ? 'Hide' : 'Restore'}</button>
              <button type="button" className="taxonomy-remove" disabled={busy} onClick={() => removeCategory(category)}>Delete</button>
            </form>)}</div>
          </section>
        </section>}
      </>}
    </section>
  );
}

function LegalPage({ kind }) {
  const privacy = kind === 'privacy';
  return (
    <article className="legal-page">
      <p className="eyebrow">CIVICSYNC HACKATHON PROTOTYPE</p>
      <h2>{privacy ? 'Privacy Policy' : 'Terms of Service'}</h2>
      <p className="legal-updated">Draft for review · Last updated 9 October 2026</p>
      <div className="legal-draft"><Icon name="alert" size={17} /><span><strong>Prototype draft—not ready for production.</strong> This page is a plain-language starting point, not legal advice. The operator’s legal identity, contact details, retention periods, and final terms must be confirmed before public launch.</span></div>
      {privacy ? <>
        <h3>Information this prototype handles</h3>        <p>When you search, your six-digit PIN code is sent through a CivicSync Supabase Edge Function to the third-party postal lookup service <a href="https://api.postalpincode.in/" target="_blank" rel="noreferrer">api.postalpincode.in</a> to check whether it belongs to Kerala. The lookup result is cached in CivicSync’s Supabase database for subsequent searches. The postal service receives the lookup request from the server, not your direct browser connection.</p>
        <p>The PIN verification function stores a cryptographic hash of the requesting IP address temporarily to limit automated PIN lookups; raw IP addresses are not stored in that table. Petition submissions do not have an application-level rate limit. Exact retention and provider logging periods must be confirmed before launch. If you use email OTP sign-in, Supabase Auth processes your email address and authentication data. Resident verification stores your full name and date of birth in a private account record, while Supabase Auth verifies control of your phone by SMS OTP. Phone OTP verifies phone access, not legal identity, and date of birth is self-reported. If you submit a petition, CivicSync stores your account ID, request title, category, PIN code, locality, description, optional reason, and submission/status timestamps. Petition details are restricted to you and authorized reviewers by database access policies.</p>
        <h3>Why information is used</h3><p>PIN lookups identify the area for public works. A private name and date of birth are required to submit petitions; household pickup requests also require a verified phone. Pickup requests contain a household address and are visible only to that resident, administrators, and the assigned ASHA Worker. These fields do not constitute government identity verification.</p>
        <h3>Storage, access, and deletion</h3><p>Data is processed by the Supabase project operator and its infrastructure providers. Exact hosting region, petition retention period, deletion request process, backups, and incident response are not configured in this prototype and must be confirmed before launch. The project currently has no public petition-detail page.</p>
        <h3>Your choices and contact</h3><p>You can browse public information without signing in. Petition and pickup submission require email sign-in, a private resident profile, and verified phone OTP. Privacy requests should be directed to the CivicSync Hackathon Project team; a monitored contact email and postal address have not yet been provided.</p>
      </> : <>
        <h3>About this prototype</h3><p>CivicSync is a hackathon prototype for discovering public works, submitting community improvement requests, and tracking household waste pickups. It is not a government service and does not represent or speak for a government department. Public project listings may be incomplete or unavailable until an authorized data source is connected.</p>
        <h3>Use of information</h3><p>Use accurate, lawful information. Do not put identity documents, emergency reports, or other sensitive personal data into petition descriptions. Resident profile and household pickup address fields are collected separately for their stated purposes and are not official identity verification. Do not submit abusive content or information you are not authorized to share. This prototype is not an emergency-response channel.</p>
        <h3>Accounts and requests</h3><p>Email OTP protects sign-in; a private resident profile is required to submit petitions, and verified phone OTP is additionally required for household pickup requests. Phone OTP does not verify legal identity. Petition approval creates an unpublished draft in CivicSync for staff review; it is not an approval, promise of public work, or official government schedule. Household pickup is a prototype workflow and is not an official waste-collection service. Account and role privileges are subject to server-side policies.</p>
        <h3>Public information and availability</h3><p>Use the department named on a project notice to verify dates, service disruptions, and urgent details. The prototype is provided for demonstration and may change or be unavailable. No warranty or service-level commitment is offered by this draft.</p>
        <h3>Operator and governing terms</h3><p>The current operator is identified as the CivicSync Hackathon Project. The responsible legal entity, governing law, dispute process, support contact, and effective date must be confirmed by the project team before production. Nothing here establishes a government relationship.</p>
      </>}
      <p className="legal-contact"><strong>Contact:</strong> CivicSync Hackathon Project · Production contact details pending.</p>
    </article>
  );
}

function App() {
  const [page, setPage] = useState('overview');
  const [theme, setTheme] = useState(readSavedTheme);
  const [pinInput, setPinInput] = useState('');
  const [pin, setPin] = useState('');
  const [localities, setLocalities] = useState([]);
  const [pinError, setPinError] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [lookupVersion, setLookupVersion] = useState(0);
  const [locality, setLocality] = useState('All localities');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [departmentFilter, setDepartmentFilter] = useState('All departments');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [petitions, setPetitions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [petitionsLoading, setPetitionsLoading] = useState(false);
  const [dataError, setDataError] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [showPetitionForm, setShowPetitionForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showResidentVerification, setShowResidentVerification] = useState(false);
  const [continueToPetition, setContinueToPetition] = useState(false);
  const [session, setSession] = useState(null);
  const [civicProfileState, setCivicProfile] = useState(null);
  const [residentVerification, setResidentVerification] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('civicsync-theme', theme);
    } catch (error) {
      console.warn('Theme preference could not be saved for the next visit.', error);
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setDataError(`Could not check sign-in status: ${error.message}`);
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    getCivicSyncRole(session.user.id)
      .then((profile) => { if (active) setCivicProfile({ ...profile, userId: session.user.id }); })
      .catch((error) => { if (active) setDataError(`${error.message}. If you just changed your role, refresh this page.`); });
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    getResidentVerification(session.user.id)
      .then((details) => { if (active) setResidentVerification(details ? { ...details, userId: session.user.id } : null); })
      .catch((error) => { if (active) setDataError(error.message); });
    return () => { active = false; };
  }, [session]);

  const civicProfile = civicProfileState?.userId === session?.user.id ? civicProfileState : null;
  const currentResidentVerification = residentVerification?.userId === session?.user.id ? residentVerification : null;
  const verifiedResident = Boolean(
    currentResidentVerification?.full_name
    && currentResidentVerification?.date_of_birth
    && session?.user.phone_confirmed_at,
  );
  const hasResidentDetails = Boolean(
    currentResidentVerification?.full_name
    && currentResidentVerification?.date_of_birth,
  );
  const canSubmitPetitions = ['citizen', 'moderator', 'representative_pending', 'representative'].includes(civicProfile?.role);

  useEffect(() => {
    if (!pin) return undefined;
    let active = true;
    async function loadArea() {
      setLoading(true);
      setDataError('');
      try {
        const [nextProjects, nextUpdates] = await Promise.all([getProjects({ pin }), getUpdates(pin)]);
        if (!active) return;
        setProjects(nextProjects);
        setUpdates(nextUpdates);
      } catch (error) {
        if (active) {
          setProjects([]);
          setUpdates([]);
          setDataError(error.message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadArea();
    return () => { active = false; };
  }, [pin, lookupVersion]);

  useEffect(() => {
    if (!pin) return undefined;
    const refreshArea = () => setLookupVersion((version) => version + 1);
    const channel = supabase
      .channel(`civicsync-public-area-${pin}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_works', filter: `pin_code=eq.${pin}` }, refreshArea)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_events', filter: 'is_public=eq.true' }, refreshArea)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [pin]);

  useEffect(() => {
    if (!session) return undefined;
    let active = true;
    async function loadPetitions() {
      setPetitionsLoading(true);
      try {
        const data = await getPetitions();
        if (active) setPetitions(data);
      } catch (error) {
        if (active) setDataError(error.message);
      } finally {
        if (active) setPetitionsLoading(false);
      }
    }
    loadPetitions();
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    const channel = supabase
      .channel(`civicsync-petitions-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petitions', filter: `user_id=eq.${session.user.id}` }, () => {
        getPetitions()
          .then(setPetitions)
          .catch((error) => setDataError(error.message));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session]);

  const departments = [...new Set(projects.map((project) => project.department).filter(Boolean))];
  const filteredProjects = useMemo(() => projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const statusMatch = statusFilter === 'All statuses' || project.status === statusFilter;
    const departmentMatch = departmentFilter === 'All departments' || project.department === departmentFilter;
    const localityMatch = locality === 'All localities' || project.locality === locality;
    const textMatch = !query || `${project.title} ${project.description} ${project.department} ${project.category} ${project.locality}`.toLowerCase().includes(query);
    return statusMatch && departmentMatch && localityMatch && textMatch;
  }), [projects, locality, statusFilter, departmentFilter, search]);

  const ongoingCount = projects.filter((project) => project.status === 'In Progress').length;
  const upcomingCount = projects.filter((project) => project.status === 'Scheduled').length;
  const attentionCount = projects.filter((project) => project.status === 'Postponed').length;
  const statuses = ['All statuses', 'Scheduled', 'In Progress', 'Postponed', 'Completed', 'Cancelled'];
  const legal = page === 'terms' || page === 'privacy';
  const canReview = ['department_official', 'coordinator', 'admin'].includes(civicProfile?.role);
  const pageTitle = { overview: 'Locality overview', projects: 'Public works', petitions: 'Community petitions', waste: 'Household pickup', asha: 'My pickup route', updates: 'Updates & notices', admin: 'Control room', terms: 'Terms of Service', privacy: 'Privacy Policy' }[page];
  const visibleNavigation = [
    ...navigation,
    ...(civicProfile?.role === 'asha_worker' ? [{ id: 'asha', label: 'My pickup route', icon: 'work' }] : []),
    ...(canReview ? [{ id: 'admin', label: 'Control room', icon: 'grid' }] : []),
  ];

  async function searchPin(event) {
    event.preventDefault();
    const cleanPin = pinInput.trim();
    if (!/^\d{6}$/.test(cleanPin)) { setPinError('Enter a valid 6-digit PIN code.'); return; }
    setPinBusy(true);
    setPinError('');
    setDataError('');
    try {
      const offices = await lookupKeralaPincode(cleanPin);
      setPin(cleanPin);
      setLookupVersion((version) => version + 1);
      setLocalities(offices);
      setLocality('All localities');
      setStatusFilter('All statuses');
      setDepartmentFilter('All departments');
      setSearch('');
      setPage('overview');
      setNotice(`PIN ${cleanPin} verified as Kerala. ${offices.length} postal-area name${offices.length === 1 ? '' : 's'} found.`);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinBusy(false);
    }
  }

  function createPetition() {
    if (!pin) { setNotice('Search and verify a Kerala PIN code before submitting a request.'); return; }
    if (!session) { setContinueToPetition(true); setShowAuth(true); return; }
    if (!civicProfile) {
      setNotice('Your account permissions are still loading. Please try again in a moment.');
      return;
    }
    if (!canSubmitPetitions) {
      setNotice(civicProfile.role === 'admin'
        ? 'Administrator accounts cannot submit petitions. Use a separate resident account.'
        : 'This staff account cannot submit resident petitions. Sign in with a resident account.');
      return;
    }
    if (!hasResidentDetails) {
      setContinueToPetition(true);
      setShowResidentVerification(true);
      return;
    }
    setShowPetitionForm(true);
  }

  async function addPetition(data) {
    const created = await submitPetition(data, session.user.id);
    setPetitions((current) => [created, ...current]);
    setShowPetitionForm(false);
    setPage('petitions');
    setNotice(`Request ${created.id} was submitted and is visible only to you and authorized reviewers.`);
  }

  async function completeSignIn(nextSession) {
    setSession(nextSession);
    setShowAuth(false);
    if (continueToPetition) {
      setContinueToPetition(false);
      try {
        const [profile, verification] = await Promise.all([
          getCivicSyncRole(nextSession.user.id),
          getResidentVerification(nextSession.user.id),
        ]);
        setCivicProfile({ ...profile, userId: nextSession.user.id });
        setResidentVerification(verification ? { ...verification, userId: nextSession.user.id } : null);
        if (!pin) setNotice('Search and verify a Kerala PIN before submitting a petition.');
        else if (!['citizen', 'moderator', 'representative_pending', 'representative'].includes(profile.role)) {
          setNotice(profile.role === 'admin'
            ? 'Administrator accounts cannot submit petitions. Use a separate resident account.'
            : 'This staff account cannot submit resident petitions.');
        } else if (!verification?.full_name || !verification?.date_of_birth) {
          setContinueToPetition(true);
          setShowResidentVerification(true);
        } else setShowPetitionForm(true);
      } catch (error) {
        setDataError(`${error.message}. Your sign-in succeeded, but your account role could not be verified.`);
      }
    } else {
      setNotice('You are signed in. Your petition details are private to you and authorized reviewers.');
    }
  }

  function completeResidentVerification(nextSession, verification) {
    setSession(nextSession);
    setResidentVerification({ ...verification, userId: nextSession.user.id });
    setShowResidentVerification(false);
    if (continueToPetition) {
      setContinueToPetition(false);
      setShowPetitionForm(true);
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) { setDataError(`Could not sign out: ${error.message}`); return; }
    setPage('overview');
    setNotice('You have signed out.');
  }

  function resetFilters() { setSearch(''); setStatusFilter('All statuses'); setDepartmentFilter('All departments'); setLocality('All localities'); }

  return (
    <div className="app-frame" data-theme={theme}>
      <aside className="sidebar">
        <button type="button" className="civic-brand" onClick={() => setPage('overview')} aria-label="CivicSync home">
          <span className="brand-symbol"><Icon name="work" size={21} /></span><span>Civic<span>Sync</span><small>PUBLIC WORKS, IN SYNC</small></span>
        </button>
        <div className="sidebar-label">CITIZEN PORTAL</div>
        <nav className="side-nav" aria-label="Main navigation">
          {visibleNavigation.map((item) => <button type="button" key={item.id} className={page === item.id ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(item.id); setNotice(''); }}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.id === 'updates' && updates.length > 0 && <span className="nav-count">{updates.length}</span>}</button>)}
        </nav>
        <div className="sidebar-help"><div className="help-icon"><Icon name="people" size={19} /></div><strong>Your neighbourhood, heard.</strong><p>Track public works, request an improvement, or arrange a household pickup.</p><button type="button" onClick={createPetition}>Submit a request <Icon name="arrow" size={15} /></button></div>
        <div className="sidebar-footer"><span className="sample-indicator" /> Kerala-only PIN support<br /><small>Government project data not connected</small></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Citizen portal</span><Icon name="chevron" size={14} />{pageTitle}</div>
          <div className="topbar-right">
            <span className="topbar-location"><Icon name="pin" size={16} />{pin ? `PIN ${pin}` : 'Kerala'}</span>
            <button type="button" className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={17} /><span>{theme === 'light' ? 'Dark' : 'Light'}</span></button>
            {session ? <button type="button" className="account-button" onClick={signOut} title="Sign out">{session.user.email} · Sign out</button> : <button type="button" className="account-button" onClick={() => setShowAuth(true)}>{authLoading ? 'Checking…' : 'Sign in'}</button>}
          </div>
        </header>

        <div className="content">
          <div className="demo-banner"><span><Icon name="alert" size={15} /> Hackathon prototype</span> PIN lookups use a third-party postal API. Public works appear only after project data is published to Supabase.</div>
          {notice && <div className="inline-notice" role="status"><Icon name="check" size={17} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><Icon name="close" size={16} /></button></div>}
          {dataError && <div className="data-error" role="alert"><Icon name="alert" size={17} /><span>{dataError} Check that the Supabase migration has been applied and the project is configured.</span><button type="button" onClick={() => setDataError('')} aria-label="Dismiss error"><Icon name="close" size={16} /></button></div>}

          <section className="page-heading"><div><p className="eyebrow">{legal ? 'CIVICSYNC HACKATHON PROJECT' : page === 'admin' || page === 'asha' ? 'AUTHORIZED STAFF' : 'YOUR NEIGHBOURHOOD, IN THE KNOW'}</p><h1>{legal ? pageTitle : page === 'overview' ? 'Good day, neighbour.' : pageTitle}</h1><p className="heading-subtitle">{legal ? 'Review the current draft and note the outstanding production details.' : page === 'admin' ? 'Secure tools for managing public works and community submissions.' : page === 'asha' ? 'Manage household collection requests assigned to your account.' : 'Find public works, understand what’s changing, and have a say in your community.'}</p></div>{!legal && page !== 'admin' && page !== 'asha' && (!session || canSubmitPetitions) && <button type="button" className="button-primary heading-action" onClick={createPetition}><Icon name="plus" size={17} /> Request an improvement</button>}</section>

          {!legal && page !== 'admin' && page !== 'asha' && <>
            <form className="pin-search" onSubmit={searchPin}>
              <div className="pin-icon"><Icon name="pin" size={21} /></div><div className="pin-copy"><label htmlFor="pin-code">Kerala area PIN code</label><span>Look up a valid Kerala postal PIN code</span></div>
              <div className="pin-entry"><input id="pin-code" value={pinInput} onChange={(event) => setPinInput(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{6}" maxLength="6" placeholder="e.g. 682001" aria-describedby={pinError ? 'pin-error' : undefined} /><button type="submit" disabled={pinBusy}><Icon name="search" size={17} />{pinBusy ? 'Checking…' : 'Find my area'}</button></div>
            </form>
            {pinError && <p className="pin-error" id="pin-error" role="alert">{pinError}</p>}
          </>}

          {page === 'overview' && <>
            <div className="area-line"><span><strong>{pin ? 'Verified Kerala PIN' : 'Search to see your locality'}</strong> {pin || 'No PIN selected'} {locality !== 'All localities' && `· ${locality}`}</span>{pin && <span className="verified-label"><Icon name="shield" size={14} /> Kerala lookup verified</span>}</div>
            {pin ? <>
              <section className="stat-grid" aria-label="Locality project summary">
                <div className="stat-card"><span className="stat-icon stat-blue"><Icon name="work" /></span><div><span>Listed projects</span><strong>{projects.length}</strong></div><small>in this PIN code</small></div>
                <div className="stat-card"><span className="stat-icon stat-cyan"><Icon name="clock" /></span><div><span>In progress</span><strong>{ongoingCount}</strong></div><small>happening now</small></div>
                <div className="stat-card"><span className="stat-icon stat-amber"><Icon name="calendar" /></span><div><span>Coming up</span><strong>{upcomingCount}</strong></div><small>scheduled works</small></div>
                <div className="stat-card"><span className="stat-icon stat-rose"><Icon name="alert" /></span><div><span>Postponed</span><strong>{attentionCount}</strong></div><small>check for updates</small></div>
              </section>
              {updates[0] && <section className="notice-card"><span className="notice-symbol"><Icon name="bell" size={18} /></span><div><strong>Local update</strong><p>{updates[0].title} <span>{updates[0].detail}</span></p></div><button type="button" onClick={() => setPage('updates')}>See all updates <Icon name="arrow" size={15} /></button></section>}
              <ProjectSection projects={filteredProjects} allProjects={projects} localities={localities} departments={departments} locality={locality} statusFilter={statusFilter} departmentFilter={departmentFilter} search={search} setLocality={setLocality} setStatusFilter={setStatusFilter} setDepartmentFilter={setDepartmentFilter} setSearch={setSearch} statuses={statuses} onSelect={setSelectedProject} onViewAll={() => setPage('projects')} onReset={resetFilters} loading={loading} compact />
              <section className="bottom-prompt"><div className="prompt-symbol"><Icon name="petition" size={21} /></div><div><strong>Something in your neighbourhood needs attention?</strong><p>Residents can submit requests after adding their private name and date of birth.</p></div>{(!session || canSubmitPetitions) && <button type="button" onClick={createPetition}>Start a petition <Icon name="arrow" size={16} /></button>}</section>
            </> : <div className="empty-state area-empty"><span className="empty-icon"><Icon name="pin" size={23} /></span><h3>Start with your Kerala PIN code</h3><p>Enter a six-digit PIN above. We’ll check it against postal service results and show published CivicSync projects for the matching area.</p></div>}
          </>}

          {page === 'projects' && <ProjectSection projects={filteredProjects} allProjects={projects} localities={localities} departments={departments} locality={locality} statusFilter={statusFilter} departmentFilter={departmentFilter} search={search} setLocality={setLocality} setStatusFilter={setStatusFilter} setDepartmentFilter={setDepartmentFilter} setSearch={setSearch} statuses={statuses} onSelect={setSelectedProject} onReset={resetFilters} loading={loading} />}
          {page === 'petitions' && (session ? <PetitionsPage pin={pin} petitions={petitions.filter((item) => !pin || item.pin === pin)} loading={petitionsLoading} onCreate={createPetition} canSubmit={canSubmitPetitions} /> : <SignInPrompt onSignIn={() => setShowAuth(true)} />)}
          {page === 'waste' && <WastePickupPage pin={pin} session={session} profile={civicProfile} verifiedResident={verifiedResident} onSignIn={() => setShowAuth(true)} onVerifyResident={() => setShowResidentVerification(true)} />}
          {page === 'asha' && (session && civicProfile?.role === 'asha_worker' ? <AshaWorkerPage session={session} /> : <div className="empty-state"><h3>ASHA Worker access required</h3><p>An administrator must assign this role to your CivicSync account.</p></div>)}
          {page === 'updates' && <UpdatesPage updates={updates} onProject={(projectId) => { const match = projects.find((item) => item.id === projectId); if (match) setSelectedProject(match); }} loading={loading} pin={pin} />}
          {page === 'admin' && (session && canReview
            ? <AdminPanel session={session} profile={civicProfile} onNotice={setNotice} />
            : <div className="empty-state"><span className="empty-icon"><Icon name="shield" size={23} /></span><h3>{session ? 'Staff access required' : 'Sign in to continue'}</h3><p>{session ? 'Your account does not have a reviewer or administrator role.' : 'Sign in with an authorized CivicSync account to open the control room.'}</p>{!session && <button type="button" className="button-primary" onClick={() => setShowAuth(true)}>Sign in</button>}</div>)}
          {legal && <LegalPage kind={page} />}

          <footer className="page-footer"><span><Icon name="shield" size={15} /> CivicSync · Kerala PIN lookup</span><span className="legal-links"><button type="button" onClick={() => setPage('terms')}>Terms of Service</button><button type="button" onClick={() => setPage('privacy')}>Privacy Policy</button></span><span>Hackathon prototype · Government data source pending</span></footer>
        </div>
      </main>
      {selectedProject && <ProjectDialog project={selectedProject} allProjects={projects} onClose={() => setSelectedProject(null)} />}
      {showAuth && <AuthDialog onClose={() => { setShowAuth(false); setContinueToPetition(false); }} onVerified={completeSignIn} />}
      {showPetitionForm && session && <PetitionDialog pin={pin} localities={localities} onClose={() => setShowPetitionForm(false)} onSubmit={addPetition} />}
      {showResidentVerification && session && <ResidentVerificationDialog session={session} residentProfile={currentResidentVerification} onClose={() => { setShowResidentVerification(false); setContinueToPetition(false); }} onVerified={completeResidentVerification} requirePhone={!continueToPetition} />}
    </div>
  );
}

function ProjectSection({ projects, allProjects, localities, departments, locality, statusFilter, departmentFilter, search, setLocality, setStatusFilter, setDepartmentFilter, setSearch, statuses, onSelect, onViewAll, onReset, loading, compact = false }) {
  return (
    <section className="projects-section">
      <div className="section-heading"><div><p className="eyebrow">{compact ? 'WHAT’S HAPPENING NEAR YOU' : 'PUBLIC INFORMATION'}</p><h2>{compact ? 'Local public works' : 'Projects in your area'} <span>{projects.length}</span></h2></div>{compact && <button type="button" className="plain-link" onClick={onViewAll}>All projects <Icon name="arrow" size={15} /></button>}</div>
      <div className="filter-bar"><label className="filter-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or departments" aria-label="Search projects or departments" /></label>
        <label className="visually-hidden" htmlFor="locality-filter">Filter by locality</label><select id="locality-filter" value={locality} onChange={(event) => setLocality(event.target.value)} disabled={!localities.length}><option>All localities</option>{localities.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="visually-hidden" htmlFor="status-filter">Filter by status</label><select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        <label className="visually-hidden" htmlFor="department-filter">Filter by department</label><select id="department-filter" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select>
      </div>
      {loading ? <div className="empty-state"><span className="loading-spinner" /><h3>Loading published projects…</h3></div> : projects.length ? <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} allProjects={allProjects} onSelect={onSelect} />)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="search" size={23} /></span><h3>{allProjects.length ? 'No projects match those filters' : 'No published projects for this PIN yet'}</h3><p>{allProjects.length ? 'Try another locality, status, or search term.' : 'Project records will appear here when an authorized department publishes them in CivicSync.'}</p><button type="button" className="button-secondary" onClick={onReset}>Clear filters</button></div>}
    </section>
  );
}

function PetitionsPage({ pin, petitions, loading, onCreate, canSubmit }) {
  return (
    <section className="petitions-page">
      <div className="petition-intro"><div><span className="petition-feature-icon"><Icon name="people" size={22} /></span><h2>Small changes start with a conversation.</h2><p>Your requests are visible only to you and authorized reviewers. Approval creates an unpublished draft project that staff must review before publication.{!canSubmit && ' Sign in with a resident account to submit petitions.'}</p></div>{canSubmit && <button type="button" className="button-primary" onClick={onCreate}><Icon name="plus" size={17} /> New request</button>}</div>
      <div className="workflow-card"><div><p className="eyebrow">HOW A REQUEST MOVES FORWARD</p><h3>From community request to staff review</h3></div><div className="workflow-steps"><span className="current"><i>1</i>Submitted</span><b>→</b><span><i>2</i>Under review</span><b>→</b><span><i>3</i>Decision</span><b>→</b><span><i>4</i>Draft project</span></div><p className="workflow-note">Approval creates an unpublished CivicSync draft. Staff must check its department and schedule, then publish it; this is not a government commitment.</p></div>
      <div className="section-heading petition-list-heading"><div><p className="eyebrow">PRIVATE TO YOUR ACCOUNT</p><h2>Your requests <span>{petitions.length}</span></h2></div></div>
      {loading ? <div className="empty-state"><span className="loading-spinner" /><h3>Loading your requests…</h3></div>
        : petitions.length ? <div className="petition-list">{petitions.map((petition) => (
          <article className="petition-card" key={petition.id}>
            <div className="petition-card-top"><span className="petition-id">{petition.id}</span><StatusBadge status={petition.status} /></div>
            <h3>{petition.title}</h3>
            <p>{petition.description}</p>
            <div className="petition-card-meta"><span><Icon name="pin" size={15} />{petition.locality} · {petition.pin}</span><span><Icon name="calendar" size={15} />Submitted {petition.submittedAt}</span><span>{petition.category}</span></div>
            <div className="petition-response"><strong>Latest response</strong><p>{petition.response || 'No response yet.'}</p>{petition.publicWorkId && <p>Linked draft project: {petition.publicWorkCode || 'created for staff review'}</p>}</div>
          </article>
        ))}</div>
          : <div className="empty-state"><span className="empty-icon"><Icon name="petition" size={23} /></span><h3>No requests {pin ? `for PIN ${pin}` : 'yet'}</h3><p>{canSubmit ? 'Submit a neighbourhood improvement request to begin tracking its review status.' : 'Sign in with a resident account to submit petitions.'}</p>{canSubmit && <button type="button" className="button-primary" onClick={onCreate}><Icon name="plus" size={16} /> Start a request</button>}</div>}
    </section>
  );
}

function SignInPrompt({ onSignIn }) {
  return <div className="empty-state sign-in-prompt"><span className="empty-icon"><Icon name="shield" size={23} /></span><h3>Sign in to view your requests</h3><p>Petition details are private to the account that submitted them and authorized reviewers.</p><button type="button" className="button-primary" onClick={onSignIn}>Sign in with email OTP</button></div>;
}

function WastePickupPage({ pin, session, profile, verifiedResident, onSignIn, onVerifyResident }) {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [localities, setLocalities] = useState([]);
  const [form, setForm] = useState({ locality: '', address: '', bagCount: '1', instructions: '' });

  useEffect(() => {
    if (!pin) return undefined;
    let active = true;
    getLocalitySuggestions(pin)
      .then((names) => { if (active) setLocalities(names); })
      .catch((loadError) => { if (active) setError(loadError.message); });
    return () => { active = false; };
  }, [pin]);

  useEffect(() => {
    if (!session || profile?.role !== 'citizen') return undefined;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const items = await getResidentWastePickups(session.user.id);
        if (active) setPickups(items);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [session, profile]);

  useEffect(() => {
    if (!session || profile?.role !== 'citizen') return undefined;
    const channel = supabase
      .channel(`civicsync-resident-pickups-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waste_pickups', filter: `resident_id=eq.${session.user.id}` }, () => {
        getResidentWastePickups(session.user.id)
          .then(setPickups)
          .catch((loadError) => setError(loadError.message));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session, profile]);

  async function submit(event) {
    event.preventDefault();
    if (!session) { onSignIn(); return; }
    if (!verifiedResident) { onVerifyResident(); return; }
    if (!pin) { setError('Verify a Kerala PIN before requesting a pickup.'); return; }
    setBusy(true);
    setError('');
    try {
      const created = await createWastePickup({ ...form, pin }, session.user.id);
      setPickups((current) => [created, ...current]);
      setForm({ locality: '', address: '', bagCount: '1', instructions: '' });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <SignInPrompt onSignIn={onSignIn} />;
  if (profile?.role !== 'citizen') return <div className="empty-state"><h3>Resident pickup requests only</h3><p>This account role does not submit household pickups. Sign in with a resident account to request a collection.</p></div>;

  return (
    <section className="waste-page">
      <div className="updates-intro"><span className="updates-intro-icon"><Icon name="water" size={23} /></span><div><h2>Household bag pickup</h2><p>Request a collection and follow each delivery-style status update from assignment to pickup.</p></div></div>
      {!pin && <div className="inline-notice" role="status">Search and verify a Kerala PIN code above before requesting a household pickup.</div>}
      <form className="admin-form waste-request-form" onSubmit={submit}>
        <div><h3>Request a collection</h3><p>Only your account, the assigned ASHA Worker, and CivicSync administrators can view the address.</p></div>
        <div className="form-grid">
          <label>Locality<input value={form.locality} onChange={(event) => setForm({ ...form, locality: event.target.value })} list="waste-locality-options" required maxLength={160} placeholder="Your postal area" /><datalist id="waste-locality-options">{localities.map((name) => <option key={name} value={name} />)}</datalist></label>
          <label>Number of bags<input type="number" min="1" max="20" value={form.bagCount} onChange={(event) => setForm({ ...form, bagCount: event.target.value })} required /></label>
        </div>
        <label>Pickup address<textarea rows="2" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} required minLength={5} maxLength={500} placeholder="Enter the household address for the assigned worker" /></label>
        <label>Pickup instructions <span className="field-hint">Optional</span><textarea rows="2" value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} maxLength={1000} placeholder="Gate, landmark, or access instructions" /></label>
        {!verifiedResident && <p className="field-hint">Before requesting a pickup, complete your private resident profile and verify your phone by SMS OTP. Date of birth is self-reported, not an official ID check.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button-primary" disabled={busy || !pin}>{busy ? 'Requesting…' : verifiedResident ? 'Request pickup' : 'Verify details to continue'}</button>
      </form>
      <div className="section-heading"><div><p className="eyebrow">PRIVATE TO YOUR ACCOUNT</p><h2>Your pickup requests <span>{pickups.length}</span></h2></div></div>
      {loading ? <div className="empty-state"><span className="loading-spinner" /><p>Loading your pickup requests…</p></div> : pickups.length ? <div className="pickup-list">{pickups.map((pickup) => <article className="pickup-card" key={pickup.recordId}>
        <div className="admin-record-title"><div><span className="petition-id">{pickup.referenceCode} · {pickup.createdAt}</span><h3>{pickup.locality} · PIN {pickup.pin}</h3></div><span className="admin-status">{pickupStatuses[pickup.status]}</span></div>
        <p>{pickup.bagCount} bag{pickup.bagCount === 1 ? '' : 's'} · {pickup.address}</p>
        {pickup.instructions && <p>{pickup.instructions}</p>}
        <div className="pickup-progress">{['requested', 'assigned', 'on_the_way', 'at_door', 'bag_collected', 'completed'].map((step) => <span key={step} className={['unable_to_collect'].includes(pickup.status) ? '' : Object.keys(pickupStatuses).indexOf(pickup.status) >= Object.keys(pickupStatuses).indexOf(step) ? 'complete' : ''}>{pickupStatuses[step]}</span>)}</div>
      </article>)}</div> : <div className="empty-state"><h3>No household pickups yet</h3><p>Use the form above to create a private pickup request.</p></div>}
    </section>
  );
}

function AshaWorkerPage({ session }) {
  const [pickups, setPickups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const items = await getAssignedWastePickups(session.user.id);
        if (active) setPickups(items);
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    const channel = supabase
      .channel(`civicsync-worker-pickups-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waste_pickups', filter: `assigned_worker_id=eq.${session.user.id}` }, () => {
        getAssignedWastePickups(session.user.id)
          .then(setPickups)
          .catch((loadError) => setError(loadError.message));
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session]);

  async function advance(pickup, status) {
    setBusyId(pickup.recordId);
    setError('');
    try {
      await updateWastePickupStatus(pickup.recordId, status);
      setPickups(await getAssignedWastePickups(session.user.id));
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusyId('');
    }
  }

  const nextStatus = {
    assigned: ['on_the_way', 'Start route'],
    on_the_way: ['at_door', 'Mark arrived'],
    at_door: ['bag_collected', 'Mark bag picked up'],
    bag_collected: ['completed', 'Complete pickup'],
  };

  return (
    <section className="waste-page">
      <div className="updates-intro"><span className="updates-intro-icon"><Icon name="work" size={23} /></span><div><h2>My pickup route</h2><p>Assigned household pickups and their current collection status.</p></div></div>
      {error && <div className="data-error" role="alert">{error}</div>}
      {loading ? <div className="empty-state"><span className="loading-spinner" /><p>Loading your assigned route…</p></div> : pickups.length ? <div className="pickup-list">{pickups.map((pickup) => <article className="pickup-card" key={pickup.recordId}>
        <div className="admin-record-title"><div><span className="petition-id">{pickup.referenceCode} · {pickup.createdAt}</span><h3>{pickup.locality} · PIN {pickup.pin}</h3></div><span className="admin-status">{pickupStatuses[pickup.status]}</span></div>
        <p><strong>Pickup address:</strong> {pickup.address}</p><p>{pickup.bagCount} bag{pickup.bagCount === 1 ? '' : 's'}{pickup.instructions ? ` · ${pickup.instructions}` : ''}</p>
        {nextStatus[pickup.status] && <button type="button" className="button-primary" disabled={busyId === pickup.recordId} onClick={() => advance(pickup, nextStatus[pickup.status][0])}>{busyId === pickup.recordId ? 'Updating…' : nextStatus[pickup.status][1]}</button>}
        {pickup.status === 'at_door' && <button type="button" className="button-secondary" disabled={busyId === pickup.recordId} onClick={() => advance(pickup, 'unable_to_collect')}>Could not collect</button>}
      </article>)}</div> : <div className="empty-state"><h3>No pickups assigned</h3><p>When an Admin assigns a household request to your account, it will appear here.</p></div>}
    </section>
  );
}

function UpdatesPage({ updates, loading, pin, onProject }) {
  return (
    <section className="updates-page">
      <div className="updates-intro"><span className="updates-intro-icon"><Icon name="bell" size={23} /></span><div><h2>Know what’s changing nearby.</h2><p>Public project milestones and disruption notices for Kerala PIN {pin || 'lookup pending'}.</p></div></div>
      {loading ? <div className="empty-state"><span className="loading-spinner" /><h3>Loading local updates…</h3></div> : updates.length ? <div className="update-list">{updates.map((update) => <article className="update-item" key={update.id}><span className="update-icon"><Icon name={update.type.toLowerCase().includes('schedule') ? 'calendar' : 'work'} size={18} /></span><div className="update-main"><div className="update-meta"><span>{update.type}</span><time>{update.date}</time></div><h3>{update.title}</h3><p>{update.detail}</p><button type="button" className="plain-link" onClick={() => onProject(update.projectId)}>View related project <Icon name="arrow" size={14} /></button></div></article>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="bell" size={23} /></span><h3>{pin ? 'No public updates for this PIN yet' : 'Search a Kerala PIN to see updates'}</h3><p>{pin ? 'There are no public project timeline updates for this area.' : 'Published updates will appear after you verify your area.'}</p></div>}
      <div className="notification-future"><Icon name="shield" size={18} /><p><strong>Notifications</strong><br />In-app public updates are available. Email, SMS, and push delivery are not connected yet.</p><span>EMAIL / SMS PENDING</span></div>
    </section>
  );
}

export default App;
