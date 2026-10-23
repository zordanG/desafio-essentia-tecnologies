import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // The browser automatically sends httpOnly cookies with withCredentials: true
  // We just need to ensure withCredentials is set on requests
  const authReq = req.clone({
    withCredentials: true,
  });

  return next(authReq);
};
