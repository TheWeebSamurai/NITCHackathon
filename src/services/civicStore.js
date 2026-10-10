import { supabase } from '../utils/supabase';

function mapProject(row) {
  return {
    recordId: row.id,
    id: row.reference_code ?? row.id,
    title: row.title,
    description: row.description,
    pin: row.pin_code,
    locality: row.locality,
    department: row.departments?.name ?? 'Department not listed',
    category: row.category,
    status: row.status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    startDate: row.start_date,
    endDate: row.end_date,
    disruption: row.disruption ?? 'No disruption details have been published.',
    isPublished: row.is_published,
    updated: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(row.updated_at)),
    timeline: (row.project_events ?? []).map((event) => ({
      recordId: event.id,
      isPublic: event.is_public,
      isCheckpoint: event.is_checkpoint,
      date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.created_at)),
      title: event.title,
      detail: event.description,
      department: event.department_name ?? row.departments?.name ?? 'CivicSync',
    })),
  };
}

function mapPetition(row) {
  return {
    id: row.reference_code ?? row.id,
    recordId: row.id,
    userId: row.user_id,
    title: row.title,
    pin: row.pin_code,
    locality: row.locality,
    category: row.category,
    status: row.status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    submittedAt: row.submitted_at ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(row.submitted_at)) : 'Not submitted',
    description: row.description,
    reason: row.reason,
    response: row.official_response ?? '',
    publicWorkId: row.public_work_id,
    publicWorkCode: row.public_work?.reference_code ?? '',
  };
}

function mapWastePickup(row) {
  return {
    recordId: row.id,
    referenceCode: row.reference_code,
    residentId: row.resident_id,
    assignedWorkerId: row.assigned_worker_id,
    pin: row.pin_code,
    locality: row.locality,
    address: row.address,
    bagCount: row.bag_count,
    instructions: row.instructions ?? '',
    status: row.status,
    createdAt: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at)),
  };
}

function throwStoreError(message, error) {
  if (error) throw new Error(`${message}: ${error.message}`, { cause: error });
}

function throwCategoryError(message, error) {
  if (error?.code === 'PGRST205' || error?.code === '42P01') {
    throw new Error('Category management is not installed in this Supabase project yet. Run 20261010013000_manage_departments_and_categories.sql in its SQL Editor, then refresh the app.', { cause: error });
  }
  if (error) throw new Error(`${message}: ${error.message}`, { cause: error });
}

export async function getCivicSyncRole(userId) {
  const { data, error } = await supabase.from('profiles').select('role, department_id').eq('id', userId).single();
  throwStoreError('Could not load account permissions', error);
  return data;
}

export async function getResidentVerification(userId) {
  const { data, error } = await supabase
    .from('resident_verifications')
    .select('full_name, date_of_birth')
    .eq('user_id', userId)
    .maybeSingle();
  throwStoreError('Could not load your private verification details', error);
  return data;
}

export async function saveResidentVerification(userId, fullName, dateOfBirth) {
  const { error } = await supabase.from('resident_verifications').upsert({
    user_id: userId,
    full_name: fullName.trim(),
    date_of_birth: dateOfBirth,
  });
  throwStoreError('Could not save your private verification details', error);
}

export async function getProjects({ pin }) {
  const { data, error } = await supabase
    .from('public_works')
    .select('*, departments(name), project_events(id, title, description, department_name, created_at, is_public, is_checkpoint)')
    .eq('pin_code', pin)
    .eq('is_published', true)
    .order('start_date');

  if (error) throw new Error(`Could not load public works: ${error.message}`, { cause: error });
  return (data ?? []).map(mapProject);
}

export async function getPetitions() {
  const { data, error } = await supabase
    .from('petitions')
    .select('id, reference_code, user_id, title, pin_code, locality, category, status, submitted_at, description, official_response, public_work_id, public_work:public_works(reference_code)')
    .order('submitted_at', { ascending: false });

  throwStoreError('Could not load your petitions', error);
  return (data ?? []).map(mapPetition);
}

export async function getAdminProjects() {
  const { data, error } = await supabase
    .from('public_works')
    .select('*, departments(name), project_events(id, title, description, department_name, created_at, is_public, is_checkpoint)')
    .order('updated_at', { ascending: false });
  throwStoreError('Could not load managed projects', error);
  return (data ?? []).map(mapProject);
}

export async function getAdminPetitions() {
  const { data, error } = await supabase
    .from('petitions')
    .select('id, reference_code, user_id, title, pin_code, locality, category, status, submitted_at, description, reason, official_response, public_work_id, public_work:public_works(reference_code)')
    .order('submitted_at', { ascending: false });
  throwStoreError('Could not load petitions for review', error);
  return (data ?? []).map(mapPetition);
}

export async function getDepartments() {
  const { data, error } = await supabase.from('departments').select('id, name').order('name');
  throwStoreError('Could not load departments', error);
  return data ?? [];
}

export async function getCategories(forUse) {
  let query = supabase.from('project_categories').select('name, for_projects, for_petitions, is_active').order('name');
  if (forUse) query = query.eq(forUse, true).eq('is_active', true);
  const { data, error } = await query;
  throwCategoryError('Could not load project categories', error);
  return data ?? [];
}

export async function renameDepartment(id, name) {
  const { error } = await supabase.from('departments').update({ name: name.trim() }).eq('id', id);
  throwStoreError('Could not rename department', error);
}

export async function deleteDepartment(id) {
  const [worksResult, profilesResult] = await Promise.all([
    supabase.from('public_works').select('id').eq('department_id', id).limit(1),
    supabase.from('profiles').select('id').eq('department_id', id).limit(1),
  ]);
  throwStoreError('Could not check department usage in projects', worksResult.error);
  throwStoreError('Could not check department assignments', profilesResult.error);
  if (worksResult.data?.length || profilesResult.data?.length) {
    throw new Error('This department is assigned to a project or staff account. Reassign those records before deleting it.');
  }
  const { error } = await supabase.from('departments').delete().eq('id', id);
  throwStoreError('Could not delete department', error);
}

export async function saveCategory(originalName, category) {
  const values = {
    name: category.name.trim(),
    for_projects: category.forProjects,
    for_petitions: category.forPetitions,
    is_active: category.isActive,
  };
  const query = originalName
    ? supabase.from('project_categories').update(values).eq('name', originalName)
    : supabase.from('project_categories').insert(values);
  const { error } = await query;
  if (error?.code === 'PGRST205' || error?.code === '42P01') throwCategoryError('Could not create category', error);
  if (error?.code === '23505') {
    throw new Error('A category with that name already exists.', { cause: error });
  }
  throwStoreError(originalName ? 'Could not update category' : 'Could not create category', error);
}

export async function deleteCategory(name) {
  const { error } = await supabase.from('project_categories').delete().eq('name', name);
  if (error?.code === 'PGRST205' || error?.code === '42P01') throwCategoryError('Could not delete category', error);
  if (error?.code === '23503') {
    throw new Error('This category is already used by a project or petition. Hide it instead to remove it from new submissions while preserving existing records.', { cause: error });
  }
  throwStoreError('Could not delete category', error);
}

export async function getLocalitySuggestions(pin) {
  const [postalResult, worksResult, petitionResult] = await Promise.all([
    supabase.from('kerala_pincodes').select('post_offices').eq('pin_code', pin).maybeSingle(),
    supabase.from('public_works').select('locality').eq('pin_code', pin),
    supabase.from('petitions').select('locality').eq('pin_code', pin),
  ]);
  throwStoreError('Could not load postal locality suggestions', postalResult.error);
  throwStoreError('Could not load existing project localities', worksResult.error);
  throwStoreError('Could not load existing petition localities', petitionResult.error);

  const postalNames = Array.isArray(postalResult.data?.post_offices)
    ? postalResult.data.post_offices.map((office) => office.name).filter(Boolean)
    : [];
  const names = [...postalNames, ...(worksResult.data ?? []).map((row) => row.locality), ...(petitionResult.data ?? []).map((row) => row.locality)];
  return [...new Map(names.map((name) => [name.trim().toLocaleLowerCase(), name.trim()])).values()].filter(Boolean);
}

export async function savePublicWork(work, userId) {
  const values = {
    title: work.title.trim(),
    description: work.description.trim(),
    pin_code: work.pin.trim(),
    locality: work.locality.trim(),
    department_id: work.departmentId,
    category: work.category,
    status: work.status,
    start_date: work.startDate,
    end_date: work.endDate,
    disruption: work.disruption.trim() || null,
    is_published: work.isPublished,
  };
  const query = work.recordId
    ? supabase.from('public_works').update(values).eq('id', work.recordId)
    : supabase.from('public_works').insert({ ...values, created_by: userId });
  const { error } = await query;
  throwStoreError(work.recordId ? 'Could not update project' : 'Could not create project', error);
}

export async function reviewPetition(recordId, status, response, project = {}) {
  const { error } = await supabase.rpc('review_civicsync_petition', {
    target_petition: recordId,
    next_status: status,
    response_text: response.trim(),
    project_department: project.departmentId || null,
    project_category: project.category || null,
    project_start: project.startDate || null,
    project_end: project.endDate || null,
  });
  throwStoreError('Could not update petition status', error);
}

export async function saveProjectCheckpoint(projectId, checkpoint, publish) {
  const { data, error } = await supabase.rpc('save_project_checkpoint', {
    target_project: projectId,
    checkpoint_title: checkpoint.title,
    checkpoint_description: checkpoint.description,
    publish_checkpoint: publish,
    target_event: checkpoint.recordId || null,
  });
  throwStoreError(publish ? 'Could not publish project checkpoint' : 'Could not save project checkpoint', error);
  return data;
}

export async function createDepartment(name) {
  const { error } = await supabase.from('departments').insert({ name: name.trim() });
  if (error?.code === '23505') {
    throw new Error(`The department “${name.trim()}” already exists. Choose a different name or edit the existing department.`, { cause: error });
  }
  throwStoreError('Could not create department', error);
}

export async function changeRoleByEmail(email, role, departmentId = null) {
  const { error } = await supabase.rpc('change_civicsync_role_by_email', {
    target_email: email.trim(),
    next_role: role,
    next_department: departmentId,
  });
  if (error?.code === 'PGRST202') {
    throw new Error('Role-by-email support is not available in this Supabase project yet. Run 20261010020000_moderator_petition_workflow.sql in the project SQL Editor, then retry.', { cause: error });
  }
  throwStoreError('Could not change account role', error);
}

export async function submitPetition(petition, userId) {
  const { data, error } = await supabase
    .from('petitions')
    .insert({
      user_id: userId,
      title: petition.title.trim(),
      category: petition.category,
      pin_code: petition.pin,
      locality: petition.locality.trim(),
      description: petition.description.trim(),
      reason: petition.reason.trim() || null,
      status: 'submitted',
    })
    .select('id, reference_code, user_id, title, pin_code, locality, category, status, submitted_at, description, official_response, public_work_id')
    .single();

  if (error) throw new Error(`Could not submit your request: ${error.message}`, { cause: error });
  return mapPetition(data);
}

export async function createWastePickup(request, userId) {
  const { data, error } = await supabase
    .from('waste_pickups')
    .insert({
      resident_id: userId,
      pin_code: request.pin,
      locality: request.locality.trim(),
      address: request.address.trim(),
      bag_count: Number(request.bagCount),
      instructions: request.instructions.trim() || null,
    })
    .select('id, reference_code, resident_id, assigned_worker_id, pin_code, locality, address, bag_count, instructions, status, created_at')
    .single();
  throwStoreError('Could not request household pickup', error);
  return mapWastePickup(data);
}

export async function getResidentWastePickups(userId) {
  const { data, error } = await supabase
    .from('waste_pickups')
    .select('id, reference_code, resident_id, assigned_worker_id, pin_code, locality, address, bag_count, instructions, status, created_at')
    .eq('resident_id', userId)
    .order('created_at', { ascending: false });
  throwStoreError('Could not load your household pickups', error);
  return (data ?? []).map(mapWastePickup);
}

export async function getAssignedWastePickups(userId) {
  const { data, error } = await supabase
    .from('waste_pickups')
    .select('id, reference_code, resident_id, assigned_worker_id, pin_code, locality, address, bag_count, instructions, status, created_at')
    .eq('assigned_worker_id', userId)
    .order('created_at');
  throwStoreError('Could not load assigned household pickups', error);
  return (data ?? []).map(mapWastePickup);
}

export async function getAdminWastePickups() {
  const { data, error } = await supabase
    .from('waste_pickups')
    .select('id, reference_code, resident_id, assigned_worker_id, pin_code, locality, address, bag_count, instructions, status, created_at')
    .order('created_at', { ascending: false });
  throwStoreError('Could not load household pickups', error);
  return (data ?? []).map(mapWastePickup);
}

export async function getAshaWorkers() {
  const { data, error } = await supabase.rpc('list_civicsync_asha_workers');
  throwStoreError('Could not load ASHA Worker accounts', error);
  return data ?? [];
}

export async function assignWastePickup(pickupId, workerId) {
  const { error } = await supabase.rpc('assign_civicsync_waste_pickup', {
    target_pickup: pickupId,
    target_worker: workerId,
  });
  throwStoreError('Could not assign household pickup', error);
}

export async function updateWastePickupStatus(pickupId, status) {
  const { error } = await supabase.rpc('update_civicsync_waste_pickup_status', {
    target_pickup: pickupId,
    next_status: status,
  });
  throwStoreError('Could not update pickup status', error);
}

export async function getUpdates(pin) {
  const { data, error } = await supabase
    .from('project_events')
    .select('id, title, description, event_type, created_at, project:public_works!inner(reference_code, pin_code, title, is_published)')
    .eq('project.pin_code', pin)
    .eq('project.is_published', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load locality updates: ${error.message}`, { cause: error });
  return (data ?? []).map((row) => ({
    id: row.id,
    projectId: row.project.reference_code ?? row.project.title,
    date: new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at)),
    title: row.title,
    detail: row.description,
    pin,
    type: row.event_type.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
  }));
}

export function getScheduleConflicts(project, projects = []) {
  const start = new Date(project.startDate);
  const end = new Date(project.endDate);
  return projects.filter((other) => (
    other.id !== project.id
    && other.pin === project.pin
    && other.locality === project.locality
    && other.status !== 'Completed'
    && new Date(other.startDate) <= end
    && new Date(other.endDate) >= start
  ));
}
