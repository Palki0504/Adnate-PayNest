export const getDashboardPath = (role) => {
  const routes = {
    customer: '/customer-dashboard',
    manager: '/manager-dashboard',
    admin: '/admin-dashboard',
  };
  return routes[role] || '/customer-dashboard';
};
