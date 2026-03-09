import React from "react";
import PropTypes from "prop-types";
import "../styles/helperStyles/Mobile.css";

const DinoLabsUnavailable = ({ screenSize }) => {
  const safeScreenSize = typeof screenSize === "number" ? screenSize : 0;

  return (
    <div className="dinolabsPageWrapper" style={{justifyContent: "center"}}>
      <div className="dinolabsUnavailableWrapper">
        <div className="dinolabsUnavailableContent">
          <img
            className="dinolabsUnavailableImage"
            src="./DinoLabsLogo-White.png"
            alt="Dino Labs Logo"
            onError={(e) => {
              e.target.src = "/fallback-logo.png"; 
            }}
          />
          <div className="dinolabsUnavailableTextStack">
            <h1 className="dinolabsUnavailableTitle">
              Dino Labs Unavailable
            </h1>
            <p className="dinolabsUnavailableMessage">
              The platform is currently unavailable on mobile devices.
            </p>
            <p className="dinolabsUnavailableSubMessage">
              Please sign in on a computer to continue.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

DinoLabsUnavailable.propTypes = {
  screenSize: PropTypes.number,
};

DinoLabsUnavailable.defaultProps = {
  screenSize: 0,
};

export default DinoLabsUnavailable;