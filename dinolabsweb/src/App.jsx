import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

import { useEffect, useState } from "react";
import "./styles/App.css";

import Login from "./pages/Authentication/AuthLogin.jsx";
import Register from "./pages/Authentication/AuthRegister.jsx";
import Reset from "./pages/Authentication/AuthReset.jsx";
import Account from "./pages/Account/Account.jsx";
import Team from "./pages/Account/Team.jsx";
import System from "./pages/Account/System.jsx";
import Calendar from "./pages/Account/Calendar.jsx";
import Database from "./pages/Account/Database.jsx";
import Studio from "./pages/Studio/Studio.jsx";
import Calculator from "./pages/Toolkit/Math/Calculator/Calculator.jsx";
import Plotting from "./pages/Toolkit/Math/Plotting/Plotting.jsx";
import Factoring from "./pages/Toolkit/Math/Factoring/Factoring.jsx";
import Matrix from "./pages/Toolkit/Math/Matrix/Matrix.jsx";
import Statistics from "./pages/Toolkit/Math/Statistics/Statistics.jsx";
import ColorType from "./pages/Toolkit/Design/ColorType/ColorType.jsx";
import BackgroundRemove from "./pages/Toolkit/Design/BackgroundRemove/BackgroundRemove.jsx";
import Compression from "./pages/Toolkit/Utilities/Compression/Compession.jsx";
import Timestamps from "./pages/Toolkit/Utilities/Timestamps/Timestamps.jsx";
import Regex from "./pages/Toolkit/Utilities/Regex/Regex.jsx";
import Latex from "./pages/Toolkit/Utilities/Latex/Latex.jsx";
import Encoding from "./pages/Toolkit/Utilities/Encoding/Encoding.jsx";
import Dictionary from "./pages/Toolkit/Text/Dictionary/Dictionary.jsx";
import Thesaurus from "./pages/Toolkit/Text/Thesaurus/Thesaurus.jsx";

function App() {
  const [osClass, setOsClass] = useState("");

  useEffect(() => {
    const detectOS = () => {
      const userAgent = navigator.userAgent;
      if (userAgent.indexOf("Win") !== -1) {
        return "windows";
      } else if (userAgent.indexOf("Mac") !== -1) {
        return "mac";
      }
      return "";
    };

    const os = detectOS();
    setOsClass(os);
  }, []);

  return (
    <Router>
      <div className={`App ${osClass}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset" element={<Reset />} />

          <Route path="/account" element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } />

          <Route path="/team" element={
            <ProtectedRoute>
              <Team />
            </ProtectedRoute>
          } />

          <Route path="/calendar" element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          } />

          <Route path="/system" element={
            <ProtectedRoute>
              <System />
            </ProtectedRoute>
          } />

          <Route path="/database" element={
            <ProtectedRoute>
              <Database />
            </ProtectedRoute>
          } />

          <Route path="/studio" element={
            <ProtectedRoute>
              <Studio />
            </ProtectedRoute>
          } />

          <Route path="/calculator" element={
            <ProtectedRoute>
              <Calculator />
            </ProtectedRoute>
          } />

          <Route path="/plotting" element={
            <ProtectedRoute>
              <Plotting />
            </ProtectedRoute>
          } />

          <Route path="/factoring" element={
            <ProtectedRoute>
              <Factoring />
            </ProtectedRoute>
          } />

          <Route path="/matrix" element={
            <ProtectedRoute>
              <Matrix />
            </ProtectedRoute>
          } />

          <Route path="/statistics" element={
            <ProtectedRoute>
              <Statistics />
            </ProtectedRoute>
          } />

          <Route path="/colortype" element={
            <ProtectedRoute>
              <ColorType />
            </ProtectedRoute>
          } />

          <Route path="/backgroundremove" element={
            <ProtectedRoute>
              <BackgroundRemove />
            </ProtectedRoute>
          } />

          <Route path="/compression" element={
            <ProtectedRoute>
              <Compression />
            </ProtectedRoute>
          } />

          <Route path="/timestamps" element={
            <ProtectedRoute>
              <Timestamps />
            </ProtectedRoute>
          } />

          <Route path="/regex" element={
            <ProtectedRoute>
              <Regex />
            </ProtectedRoute>
          } />

          <Route path="/latex" element={
            <ProtectedRoute>
              <Latex />
            </ProtectedRoute>
          } />

          <Route path="/encoding" element={
            <ProtectedRoute>
              <Encoding />
            </ProtectedRoute>
          } />

          <Route path="/dictionary" element={
            <ProtectedRoute>
              <Dictionary />
            </ProtectedRoute>
          } />

          <Route path="/thesaurus" element={
            <ProtectedRoute>
              <Thesaurus />
            </ProtectedRoute>
          } />

          <Route index element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;