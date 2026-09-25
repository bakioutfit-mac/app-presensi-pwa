const fs = require('fs');
const content = fs.readFileSync('components/AdminOwnerDashboard.js', 'utf8');
const lines = content.split('\n');

// We will write a small script to grab lines from start to end
function getLines(start, end) {
    return lines.slice(start - 1, end).join('\n');
}

fs.writeFileSync('components/tabs/owner/OwnerMonitoringTab.js', 
`'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/date';
import { Search, Filter, RefreshCw, X, Camera } from 'lucide-react';

export default function OwnerMonitoringTab({ user, outlets, selectedOutlet, setSelectedOutlet, showToast }) {
` + getLines(135, 297) + `

  return (
    <>
      ` + getLines(914, 1076) + `
    </>
  );
}
`);
console.log('OwnerMonitoringTab created');
