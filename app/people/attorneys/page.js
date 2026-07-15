'use client';
import { useEffect } from 'react';
import PeopleListView from '../../../components/PeopleListView';

export default function AttorneysPage() {
  useEffect(() => {
    document.title = 'Directory';
  }, []);

  return <PeopleListView title="Attorneys" identityFilter="Attorney" />;
}
