import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUserFn } from '../api/trackerApi';
import { useMutation } from '@tanstack/react-query';
import {
  ILoginResponse,
  IPasswordValidation,
  IUsernameValidation,
} from '../types';
import { useUserDataStore } from '../store/userData';
import { toast } from 'react-toastify';
import { AxiosError } from 'axios';
import Loader from '../components/Loader';
import {
  validateUsername,
  validatePassword,
  validatePasswordMatch,
} from '../utils/validation';

function RegisterScreen() {
  const { user, setUser } = useUserDataStore();
  const [username, setUsername] = useState(user?.username || '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPasswordRequirements, setShowPasswordRequirements] =
    useState(false);
  const [showUsernameRequirements, setShowUsernameRequirements] =
    useState(false);
  const navigate = useNavigate();

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Detailed validation states
  const [usernameValidation, setUsernameValidation] =
    useState<IUsernameValidation>({
      minLength: false,
      maxLength: true,
      validCharacters: false,
      notEmpty: false,
    });

  const [passwordValidation, setPasswordValidation] =
    useState<IPasswordValidation>({
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });

  // Update detailed validation states
  useEffect(() => {
    setUsernameValidation({
      notEmpty: username.trim().length > 0,
      minLength: username.length >= 3,
      maxLength: username.length <= 20,
      validCharacters: /^[a-zA-Z0-9_-]*$/.test(username),
    });
  }, [username]);

  useEffect(() => {
    setPasswordValidation({
      minLength: password.length >= 8,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    });
  }, [password]);

  // Validate fields when they change and are touched
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (touched.username) {
      const usernameError = validateUsername(username);
      if (usernameError) newErrors.username = usernameError;
    }

    if (touched.password) {
      const passwordError = validatePassword(password);
      if (passwordError) newErrors.password = passwordError;
    }

    if (touched.passwordConfirmation) {
      const passwordMatchError = validatePasswordMatch(
        password,
        passwordConfirmation
      );
      if (passwordMatchError)
        newErrors.passwordConfirmation = passwordMatchError;
    }

    setErrors(newErrors);
  }, [username, password, passwordConfirmation, touched]);

  const isFormValid = () => {
    return (
      username.trim().length >= 3 &&
      username.length <= 20 &&
      /^[a-zA-Z0-9_-]+$/.test(username) &&
      password.length >= 8 &&
      password === passwordConfirmation &&
      passwordConfirmation.length > 0
    );
  };

  const handleFieldChange = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    if (field === 'username') setUsername(value);
    if (field === 'password') setPassword(value);
    if (field === 'passwordConfirmation') setPasswordConfirmation(value);
  };

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: registerUserFn,
    onSuccess: (data: ILoginResponse) => {
      setUser(data);
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data.message);
      } else {
        toast.error(error.message ? error.message : 'An error occurred');
      }
    },
  });

  async function submitHandler(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Mark all fields as touched for final validation
    setTouched({ username: true, password: true, passwordConfirmation: true });

    if (!isFormValid()) {
      toast.error('Please fix all validation errors before submitting');
      return;
    }

    mutate({ username, password, passwordConfirmation });
  }

  useEffect(() => {
    if (isSuccess) {
      toast.success('Registration successful');
      navigate('/');
    }
  }, [navigate, isSuccess]);

  return (
    <div className="relative">
      <div className="h-screen flex justify-center items-center bg-base-200">
        <div className="card shrink-0 w-full max-w-sm shadow-2xl bg-base-100">
          <form className="card-body" onSubmit={submitHandler}>
            <h2 className="text-2xl font-bold text-center mb-4">
              Create Account
            </h2>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Username</span>
              </label>
              <input
                type="text"
                placeholder="Username"
                className={`input input-bordered ${
                  errors.username
                    ? 'input-error'
                    : touched.username && !errors.username && username
                      ? 'input-success'
                      : ''
                }`}
                value={username}
                onChange={(e) => handleFieldChange('username', e.target.value)}
                onFocus={() => setShowUsernameRequirements(true)}
                onBlur={() =>
                  setTimeout(() => setShowUsernameRequirements(false), 150)
                }
                required
              />
              {errors.username && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.username}
                  </span>
                </label>
              )}

              {showUsernameRequirements && (
                <div className="mt-2 p-3 bg-base-200 rounded-box text-xs">
                  <p className="font-semibold mb-2 text-base-content">
                    Username Requirements:
                  </p>
                  <ul className="space-y-1">
                    <li
                      className={`flex items-center gap-2 ${usernameValidation.notEmpty ? 'text-success' : 'text-base-content/60'}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${usernameValidation.notEmpty ? 'bg-success' : 'bg-base-content/30'}`}
                      ></span>
                      Not empty
                    </li>
                    <li
                      className={`flex items-center gap-2 ${usernameValidation.minLength ? 'text-success' : 'text-base-content/60'}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${usernameValidation.minLength ? 'bg-success' : 'bg-base-content/30'}`}
                      ></span>
                      At least 3 characters
                    </li>
                    <li
                      className={`flex items-center gap-2 ${usernameValidation.maxLength ? 'text-success' : 'text-error'}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${usernameValidation.maxLength ? 'bg-success' : 'bg-error'}`}
                      ></span>
                      Maximum 20 characters
                    </li>
                    <li
                      className={`flex items-center gap-2 ${usernameValidation.validCharacters ? 'text-success' : 'text-base-content/60'}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${usernameValidation.validCharacters ? 'bg-success' : 'bg-base-content/30'}`}
                      ></span>
                      Only letters, numbers, hyphens, and underscores
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="Password"
                className={`input input-bordered ${
                  errors.password
                    ? 'input-error'
                    : touched.password && !errors.password && password
                      ? 'input-success'
                      : ''
                }`}
                value={password}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                onFocus={() => setShowPasswordRequirements(true)}
                onBlur={() =>
                  setTimeout(() => setShowPasswordRequirements(false), 150)
                }
                required
              />
              {errors.password && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.password}
                  </span>
                </label>
              )}

              {showPasswordRequirements && (
                <div className="mt-2 p-3 bg-base-200 rounded-box text-xs">
                  <p className="font-semibold mb-2 text-base-content">
                    Password Requirements:
                  </p>
                  <ul className="space-y-1">
                    <li
                      className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-success' : 'text-base-content/60'}`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${passwordValidation.minLength ? 'bg-success' : 'bg-base-content/30'}`}
                      ></span>
                      At least 8 characters
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password Confirmation</span>
              </label>
              <input
                type="password"
                placeholder="Confirm password"
                className={`input input-bordered ${
                  errors.passwordConfirmation
                    ? 'input-error'
                    : touched.passwordConfirmation &&
                        !errors.passwordConfirmation &&
                        passwordConfirmation
                      ? 'input-success'
                      : ''
                }`}
                value={passwordConfirmation}
                onChange={(e) =>
                  handleFieldChange('passwordConfirmation', e.target.value)
                }
                required
              />
              {errors.passwordConfirmation && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {errors.passwordConfirmation}
                  </span>
                </label>
              )}

              <label className="label">
                <Link to="/login" className="label-text-alt link link-hover">
                  Already have an account?
                </Link>
              </label>
            </div>

            <div className="form-control flex justify-center mt-6">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!isFormValid() || isPending}
              >
                {isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Creating Account...
                  </>
                ) : (
                  'Register'
                )}
              </button>
            </div>
          </form>
          {isPending && <Loader />}
        </div>
      </div>
    </div>
  );
}

export default RegisterScreen;
