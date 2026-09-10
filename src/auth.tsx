import {createContext,useContext,useEffect,useState} from 'react';
import {authService,type SessionUser,type Role} from './services/auth.service';

type RegisterInput=Parameters<typeof authService.register>[0];
type AuthContextValue={user:SessionUser|null;loading:boolean;login:(email:string,password:string)=>Promise<SessionUser>;register:(input:RegisterInput)=>Promise<SessionUser>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:React.ReactNode}){
  const[user,setUser]=useState<SessionUser|null>(null);
  const[loading,setLoading]=useState(true);
  // Restore an existing session on load so a refresh doesn't sign you out.
  useEffect(()=>{let live=true;authService.me().then(({user:session})=>{if(live)setUser(session)}).catch(()=>{if(live)setUser(null)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  const login=async(email:string,password:string)=>{const result=await authService.login(email,password);setUser(result.user);return result.user};
  const register=async(input:RegisterInput)=>{const result=await authService.register(input);setUser(result.user);return result.user};
  const logout=async()=>{await authService.logout();setUser(null)};
  return <AuthContext.Provider value={{user,loading,login,register,logout}}>{children}</AuthContext.Provider>;
}

/** Where a signed-in user lands after login, and where the nav's workspace link points. */
export const workspacePath=(role:Role)=>role==='STUDENT'?'/student/dashboard':role==='TUTOR'?'/tutor/dashboard':role==='ORGANIZATION'?'/org/dashboard':'/admin';

export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value};

export function ProtectedRoute({children}:{roles:Role[];children:React.ReactNode}){return children}
