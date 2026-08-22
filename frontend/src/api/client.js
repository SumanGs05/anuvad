const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5000';

async function request(path, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    options
  );

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      'Request failed'
    );
  }

  return data;
}

export async function login(
  email,
  password
) {
  return request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  });
}

export async function register(
  email,
  password
) {
  return request('/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email,
      password
    })
  });
}

export async function createJob(
  file,
  targetLanguage,
  token
) {
  const formData = new FormData();

  formData.append(
    'document',
    file
  );

  formData.append(
    'targetLanguage',
    targetLanguage
  );

  return request('/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });
}

export async function getJob(
  jobId,
  token
) {
  return request(
    `/jobs/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}

export async function listJobs(
  token
) {
  return request('/jobs', {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function downloadJob(
  jobId,
  token
) {
  const response =
    await fetch(
      `${API_BASE_URL}/jobs/${jobId}/download`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );

  if (!response.ok) {
    const data =
      await response
        .json()
        .catch(() => ({}));

    throw new Error(
      data.error ||
      'Download failed'
    );
  }

  return response.blob();
}
